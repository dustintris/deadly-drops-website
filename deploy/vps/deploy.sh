#!/usr/bin/env bash
# Deploy the Deadly Drops site (web/) to the VPS as a Node + PostgreSQL stack.
#
#   bash deploy/vps/deploy.sh          # from the repo root, in Git Bash
#
# Env overrides: DEPLOY_HOST (ssh alias, default smj),
#                SITE_URL (public URL baked into the build, default https://ddptournament.com).
#
# First time only, create the server secrets, then run this script:
#   scp deploy/vps/.env.example smj:/root/deadly-drops/.env   # then fill it in on the server
#
# The image is built on the server (Linux binaries, no registry). The image that
# was running before is kept as deadly-drops-web:previous. To roll back the code
# (not the database migrations), on the server in /root/deadly-drops:
#   docker tag deadly-drops-web:previous deadly-drops-web:latest && docker compose up -d web
#
# /root/deadly-drops/www holds the releases of the old nginx static site. Nothing
# uses it any more; delete it by hand once this deploy is confirmed working.
set -euo pipefail

HOST="${DEPLOY_HOST:-smj}"
SITE_URL="${SITE_URL:-https://ddptournament.com}"
REMOTE=/root/deadly-drops
# It is pasted into a remote command below: accept only a plain https origin
if [[ ! "$SITE_URL" =~ ^https://[A-Za-z0-9.-]+$ ]]; then
  echo "ERROR: SITE_URL must look like https://example.com (got: $SITE_URL)" >&2
  exit 1
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
scp -q deploy/vps/docker-compose.yml deploy/vps/backup.sh deploy/vps/server-steps.sh deploy/vps/ci-deploy.sh "$HOST:$REMOTE/"
ssh "$HOST" "chmod 755 $REMOTE/ci-deploy.sh $REMOTE/server-steps.sh"

echo "==> Building and starting on $HOST"
ssh "$HOST" "cd $REMOTE && SITE_URL='$SITE_URL' flock -w 600 /var/lock/ddp-deploy.lock bash ./server-steps.sh"

echo "==> Live: $SITE_URL"
