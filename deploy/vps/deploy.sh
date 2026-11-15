#!/usr/bin/env bash
# Build the Next.js site (web/) and publish it to the VPS.
#
#   bash deploy/vps/deploy.sh
#
# Env overrides: DEPLOY_HOST (ssh alias, default smj), SITE_URL.
# Each run uploads a new release, then atomically repoints www/current to it.
# The last 5 releases are kept; roll back by repointing the symlink.
set -euo pipefail

HOST="${DEPLOY_HOST:-smj}"
SITE_URL="${SITE_URL:-https://ddptournament.com}"
REMOTE=/root/deadly-drops
HERE="$(cd "$(dirname "$0")" && pwd)"
REL="$(date -u +%Y%m%d-%H%M%S)"

cd "$HERE/../../web"
[ -d node_modules ] || npm ci --no-audit --no-fund
NEXT_PUBLIC_SITE_URL="$SITE_URL" npm run build

echo "==> Uploading release $REL to $HOST"
ssh "$HOST" "mkdir -p $REMOTE/www/releases/$REL"
tar -C out -czf - . | ssh "$HOST" "tar -xzf - -C $REMOTE/www/releases/$REL"
scp -q "$HERE/docker-compose.yml" "$HERE/nginx.conf" "$HOST:$REMOTE/"

echo "==> Activating release"
ssh "$HOST" "set -e
  cd $REMOTE/www
  ln -sfn releases/$REL current.tmp && mv -Tf current.tmp current
  ls -1d releases/* | sort -r | tail -n +6 | xargs -r rm -rf
  cd $REMOTE
  docker compose up -d --quiet-pull
  docker compose exec -T web nginx -s reload"

echo "==> Live: $SITE_URL"
