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
scp -q deploy/vps/docker-compose.yml deploy/vps/backup.sh "$HOST:$REMOTE/"

echo "==> Building and starting on $HOST"
ssh "$HOST" "SITE_URL='$SITE_URL' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail
cd /root/deadly-drops
chmod 600 .env
chmod 755 backup.sh
mkdir -p data/uploads backups
chmod 700 backups
chown -Rh 1000:1000 data   # the image's node user (uid 1000) writes the uploads; -h: never follow symlinks

if docker image inspect deadly-drops-web:latest >/dev/null 2>&1; then
  docker tag deadly-drops-web:latest deadly-drops-web:previous
fi
NEXT_PUBLIC_SITE_URL="$SITE_URL" docker compose build web
if ! docker compose up -d --remove-orphans; then
  docker compose ps
  docker compose logs --tail=80 db web >&2
  exit 1
fi

echo "Waiting up to 90 s for web to report healthy..."
status=starting
for _ in $(seq 1 45); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q web)" 2>/dev/null || echo missing)"
  case "$status" in healthy|unhealthy) break ;; esac
  sleep 2
done
docker compose ps
if [ "$status" != healthy ]; then
  echo "ERROR: web is '$status', not healthy. Last log lines:" >&2
  docker compose logs --tail=80 web >&2
  exit 1
fi

# Only this project's dangling images: other sites share this Docker host
docker image prune -f --filter label=com.docker.compose.project=deadly-drops >/dev/null
REMOTE_SCRIPT

echo "==> Live: $SITE_URL"
