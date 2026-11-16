#!/usr/bin/env bash
# The ONLY command the GitHub Actions deploy key may run on the VPS (forced in root's
# ~/.ssh/authorized_keys with `restrict,command="/root/deadly-drops/ci-deploy.sh"`): no shell, no
# forwarding, no other project. It reads a .tar.gz holding web/ and deploy/vps/ on stdin, swaps it in
# as ./app and rebuilds with server-steps.sh. Installed and updated by deploy.sh from a laptop, never
# from a CI bundle, so CI can't widen what its own key may do.
set -euo pipefail
umask 022
cd /root/deadly-drops

exec 9>/var/lock/ddp-deploy.lock
flock -w 600 9 || { echo "Another deploy is still running." >&2; exit 1; }

rm -rf incoming && mkdir incoming
# at most 200 MB; a cut-off bundle makes tar fail
head -c 200000000 | tar -xzf - --no-same-owner -C incoming
for f in web/package.json deploy/vps/docker-compose.yml deploy/vps/backup.sh deploy/vps/server-steps.sh; do
  [ -f "incoming/$f" ] || { echo "ERROR: the bundle has no $f" >&2; rm -rf incoming; exit 1; }
done

rm -rf app.old
if [ -d app ]; then mv app app.old; fi
mv incoming/web app
rm -rf app.old
cp incoming/deploy/vps/docker-compose.yml incoming/deploy/vps/backup.sh incoming/deploy/vps/server-steps.sh .
rm -rf incoming

exec bash ./server-steps.sh   # keeps the lock (fd 9) until it finishes
