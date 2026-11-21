#!/usr/bin/env bash
# Deploy the Deadly Drops site (web/) to a VPS as a Docker Compose stack, from a laptop. Day to day,
# GitHub Actions deploys (.github/workflows/deploy-vps.yml); this is the fallback, and the only thing
# that installs or updates ci-deploy.sh on a server. Operations: deploy/vps/RUNBOOK.md.
#
#   bash deploy/vps/deploy.sh                   # from the repo root, in Git Bash: the dedicated server
#   DEPLOY_HOST=smj bash deploy/vps/deploy.sh   # the old shared server, until it is retired
#
# Env overrides: DEPLOY_HOST (ssh target, default root@179.66.153.48, the dedicated server),
#                SITE_URL (public URL baked into the build). Normally unset: each server's .env says
#                its own (SITE_URL=..., else https://ddptournament.com). Set it to override one deploy.
#
# Each server's /root/deadly-drops/.env also picks its variant (see .env.example):
#   dedicated server (ddptournaments.com): COMPOSE_FILE=docker-compose.standalone.yml, SITE_DOMAIN,
#     SITE_URL; its own Caddy in that compose file terminates HTTPS
#   old shared server (ddptournament.com): none of them, so docker-compose.yml behind the shared proxy
#
# First time on a new server (Ubuntu, as root; details in RUNBOOK.md):
#   1. Docker Engine and the Compose plugin: https://docs.docker.com/engine/install/ubuntu/
#   2. Swap, so `next build` survives a small server (skip if `swapon --show` lists some):
#        fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
#        echo '/swapfile none swap sw 0 0' >> /etc/fstab
#   3. Firewall: ssh and the web only (allow your ssh port before enabling, or you lock yourself out):
#        ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
#      Docker's published ports skip ufw, which is why the compose file publishes only Caddy's.
#   4. Secrets: `mkdir -p /root/deadly-drops` on the server, then from the laptop
#        scp deploy/vps/.env.example root@179.66.153.48:/root/deadly-drops/.env
#      and fill it in on the server. POSTGRES_PASSWORD must be set before the first start.
#   5. DNS: A records for the domain and www pointing at the server (Hostinger). Caddy gets the
#      certificates on its own once they resolve.
#   6. Run this script. Then restore the latest backup if there is one (RUNBOOK.md).
#   7. Nightly backups: `crontab -e` as root and add
#        15 3 * * * /root/deadly-drops/backup.sh >> /root/deadly-drops/backups/backup.log 2>&1
#   8. CI deploys: make a key pair for GitHub Actions only, e.g. `ssh-keygen -t ed25519 -N '' -f ddp-ci`,
#      and add the public half to /root/.ssh/authorized_keys on the server as ONE line:
#        restrict,command="/root/deadly-drops/ci-deploy.sh" ssh-ed25519 AAAA... ddp-ci
#      Then set the GitHub secrets VPS_HOST (the server's IP), VPS_SSH_KEY (the private half; then
#      delete the local copy) and VPS_KNOWN_HOSTS (`ssh-keyscan -t ed25519 <IP>`, compared with
#      `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server). CI deploys only to VPS_HOST.
#   9. Desktop app releases (the dedicated server): a second key, for the desktop repo's CI, whose forced
#      command is receive-desktop-release.sh. See RUNBOOK.md, Desktop app releases.
#
# The image is built on the server (Linux binaries, no registry). The image that
# was running before is kept as deadly-drops-web:previous. To roll back the code
# (not the database migrations), on the server in /root/deadly-drops:
#   docker tag deadly-drops-web:previous deadly-drops-web:latest && docker compose up -d web
set -euo pipefail

HOST="${DEPLOY_HOST:-root@179.66.153.48}"
SITE_URL="${SITE_URL:-}"
REMOTE=/root/deadly-drops
# Passed on only when given, so the server's own .env decides otherwise. It is pasted into a remote
# command below: accept only a plain https origin
site_env=
if [ -n "$SITE_URL" ]; then
  if [[ ! "$SITE_URL" =~ ^https://[A-Za-z0-9.-]+$ ]]; then
    echo "ERROR: SITE_URL must look like https://example.com (got: $SITE_URL)" >&2
    exit 1
  fi
  site_env="SITE_URL='$SITE_URL' "
fi
cd "$(dirname "$0")/../.."

echo "==> Tests and typecheck"
npm --prefix web test
npm --prefix web run typecheck

echo "==> Checking $HOST"
has_env="$(ssh "$HOST" "mkdir -p $REMOTE && if [ -f $REMOTE/.env ]; then echo yes; else echo no; fi")"
if [ "$has_env" != yes ]; then
  echo "ERROR: $REMOTE/.env is missing on $HOST, so there are no secrets to start with." >&2
  echo "Create it from the template and fill it in on the server, then rerun:" >&2
  echo "  scp deploy/vps/.env.example $HOST:$REMOTE/.env" >&2
  exit 1
fi

echo "==> Uploading web/ to $HOST:$REMOTE/app"
ssh "$HOST" "rm -rf $REMOTE/app.new && mkdir $REMOTE/app.new"
# The ./ prefix anchors the patterns, so only these top-level entries are skipped
tar -C web -czf - \
  --exclude=./node_modules --exclude=./.next --exclude=./out \
  --exclude=./data --exclude=./.pgdata --exclude='./.env*' \
  . | ssh "$HOST" "tar -xzf - --no-same-owner -C $REMOTE/app.new"
# Swap the new tree in. Two renames, but nothing reads app/ until the build below
ssh "$HOST" "cd $REMOTE && rm -rf app.old && { [ ! -d app ] || mv app app.old; } && mv app.new app && rm -rf app.old"
# Both compose variants go to every server; its .env (COMPOSE_FILE) picks one
# (receive-desktop-release.sh: the desktop release key's forced command, checking releases with
# desktop-update-signing.pub.pem; publish-desktop.sh stays on the laptop)
scp -q deploy/vps/docker-compose.yml deploy/vps/docker-compose.standalone.yml deploy/vps/Caddyfile \
  deploy/vps/backup.sh deploy/vps/server-steps.sh deploy/vps/ci-deploy.sh deploy/vps/receive-desktop-release.sh \
  deploy/vps/desktop-update-signing.pub.pem "$HOST:$REMOTE/"
ssh "$HOST" "chmod 755 $REMOTE/ci-deploy.sh $REMOTE/server-steps.sh $REMOTE/receive-desktop-release.sh &&
  chmod 644 $REMOTE/desktop-update-signing.pub.pem"

echo "==> Building and starting on $HOST"
# DEPLOY_SHOW_LOGS=1: from a laptop, a failed deploy prints the container logs here (CI keeps them on the server)
ssh "$HOST" "cd $REMOTE && DEPLOY_SHOW_LOGS=1 ${site_env}flock -w 600 /var/lock/ddp-deploy.lock bash ./server-steps.sh"

if [ -n "$SITE_URL" ]; then
  echo "==> Live: $SITE_URL"
else
  echo "==> Live at the SITE_URL in $HOST:$REMOTE/.env (https://ddptournament.com if it sets none)"
fi
