#!/usr/bin/env bash
# Build and (re)start the Deadly Drops stack from /root/deadly-drops/app, then wait for the health check.
# Runs on the VPS, called by deploy.sh (from a laptop) and ci-deploy.sh (GitHub Actions), always under
# /var/lock/ddp-deploy.lock so two deploys never overlap.
set -euo pipefail

SITE_URL="${SITE_URL:-https://ddptournament.com}"
cd /root/deadly-drops
[ -f .env ] || { echo "ERROR: /root/deadly-drops/.env is missing (see deploy/vps/.env.example)" >&2; exit 1; }

chmod 600 .env
chmod 755 backup.sh
mkdir -p data/uploads backups
chmod 700 backups
chown -Rh 1000:1000 data   # the image's node user (uid 1000) writes the uploads; -h: never follow symlinks

# keep the running image for a quick rollback:
#   docker tag deadly-drops-web:previous deadly-drops-web:latest && docker compose up -d web
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

# only this project's dangling images: other sites share this Docker host
docker image prune -f --filter label=com.docker.compose.project=deadly-drops >/dev/null
echo "Deployed."
