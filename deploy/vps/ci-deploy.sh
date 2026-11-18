#!/usr/bin/env bash
# The ONLY command the GitHub Actions deploy key may run on the VPS (forced in root's
# ~/.ssh/authorized_keys with `restrict,command="/root/deadly-drops/ci-deploy.sh"`): no shell, no
# forwarding, no other project. It reads a .tar.gz holding web/ and deploy/vps/ on stdin, swaps it in
# as ./app, copies the server files next to it and rebuilds with server-steps.sh. Installed and updated
# by deploy.sh from a laptop, never from a CI bundle, so CI can't widen what its own key may do.
#
# One script for both servers: each server's .env (COMPOSE_FILE) picks the compose file. The dedicated
# server's docker-compose.standalone.yml and Caddyfile are copied whenever the bundle has them; on the
# old shared server they sit unused.
set -euo pipefail
umask 022
cd /root/deadly-drops

exec 9>/var/lock/ddp-deploy.lock
flock -w 600 9 || { echo "Another deploy is still running." >&2; exit 1; }

rm -rf incoming && mkdir incoming
# at most 200 MB; a cut-off bundle makes tar fail. --no-same-permissions: the umask applies and no
# setuid/setgid bit comes from the bundle (root's tar would otherwise keep them)
head -c 200000000 | tar -xzf - --no-same-owner --no-same-permissions -C incoming
# Plain files and folders only: through a symlink the checks and copies below would read or write
# anywhere on the server. Git and the workflow's tar never produce one.
bad="$(find incoming ! -type f ! -type d -print -quit)"
if [ -n "$bad" ]; then
  echo "ERROR: the bundle holds a symlink or special file: ${bad#incoming/}" >&2; rm -rf incoming; exit 1
fi
for f in web/package.json deploy/vps/docker-compose.yml deploy/vps/backup.sh deploy/vps/server-steps.sh; do
  [ -f "incoming/$f" ] || { echo "ERROR: the bundle has no $f" >&2; rm -rf incoming; exit 1; }
done

rm -rf app.old
if [ -d app ]; then mv app app.old; fi
mv incoming/web app
rm -rf app.old
# The first three are required above. The last two are optional, so a bundle from before them still
# deploys. Fixed names, copied into this folder only. -T: fail rather than copy into a folder of the
# same name (Docker creates one when a bind-mounted file such as ./Caddyfile is missing)
for f in docker-compose.yml backup.sh server-steps.sh docker-compose.standalone.yml Caddyfile; do
  if [ -f "incoming/deploy/vps/$f" ]; then cp -T "incoming/deploy/vps/$f" "$f"; fi
done
rm -rf incoming

exec bash ./server-steps.sh   # keeps the lock (fd 9) until it finishes
