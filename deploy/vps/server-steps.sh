#!/usr/bin/env bash
# Build and (re)start the Deadly Drops stack from /root/deadly-drops/app, then wait for the health check.
# Runs on the VPS, called by deploy.sh (from a laptop) and ci-deploy.sh (GitHub Actions), always under
# /var/lock/ddp-deploy.lock so two deploys never overlap.
set -euo pipefail

cd /root/deadly-drops
[ -f .env ] || { echo "ERROR: /root/deadly-drops/.env is missing (see deploy/vps/.env.example)" >&2; exit 1; }
# The public address baked into the build: from the caller, else this server's .env (SITE_URL=…), else the
# original domain. Each server keeps its own, so CI can deploy anywhere without knowing which domain it is.
SITE_URL="${SITE_URL:-$(sed -n 's/^SITE_URL=//p' .env | tail -n 1 | tr -d "\"'\r")}"
SITE_URL="${SITE_URL:-https://ddptournament.com}"
[[ "$SITE_URL" =~ ^https://[A-Za-z0-9.-]+$ ]] || { echo "ERROR: SITE_URL must look like https://example.com (got: $SITE_URL)" >&2; exit 1; }

chmod 600 .env
chmod 755 backup.sh
mkdir -p data/uploads backups
chmod 700 backups
chown -Rh 1000:1000 data   # the image's node user (uid 1000) writes the uploads; -h: never follow symlinks

# Container logs can hold request details: a CI deploy's output lands in a PUBLIC Actions log, so there they go to
# a file on the server instead. deploy.sh (a laptop) sets DEPLOY_SHOW_LOGS=1 to see them straight away.
show_logs() {
  if [ "${DEPLOY_SHOW_LOGS:-0}" = 1 ]; then
    docker compose logs --tail=80 "$@" >&2
  else
    (umask 077 && docker compose logs --tail=200 "$@" > deploy-fail.log 2>&1) || true
    echo "The container logs are in /root/deadly-drops/deploy-fail.log on the server (kept out of the CI log)." >&2
  fi
}

# A server with its own Caddy (docker-compose.standalone.yml, a dedicated server) or behind a shared proxy.
# Captured first: `… | grep -q` can end the pipe early and, with pipefail, read as "no".
services="$(docker compose config --services)"
own_proxy=0
if grep -qx caddy <<<"$services"; then own_proxy=1; fi

# keep the running image for a quick rollback:
#   docker tag deadly-drops-web:previous deadly-drops-web:latest && docker compose up -d web
if docker image inspect deadly-drops-web:latest >/dev/null 2>&1; then
  docker tag deadly-drops-web:latest deadly-drops-web:previous
fi
# --pull: the base images (node:24-slim) are floating tags; each deploy picks up their latest security patches
NEXT_PUBLIC_SITE_URL="$SITE_URL" docker compose build --pull web
# the same for the images used as they are (postgres:18-alpine, caddy:2-alpine): patch releases only
if [ "$own_proxy" = 1 ]; then
  docker compose pull --quiet db caddy || echo "WARNING: couldn't pull newer db/caddy images; keeping the current ones" >&2
else
  docker compose pull --quiet db || echo "WARNING: couldn't pull a newer db image; keeping the current one" >&2
fi
if ! docker compose up -d --remove-orphans; then
  docker compose ps
  show_logs db web
  exit 1
fi
# Own Caddy: `up -d` leaves a running caddy alone when only its mounted Caddyfile changed, and Caddy doesn't watch
# the file, so reload it. A graceful reload keeps connections open.
if [ "$own_proxy" = 1 ]; then
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile ||
    echo "WARNING: Caddy didn't reload its Caddyfile; the previous config is still serving" >&2
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
  echo "ERROR: web is '$status', not healthy." >&2
  show_logs web
  exit 1
fi

# only this project's dangling images (on a shared server, other sites use this Docker host too)
docker image prune -f --filter label=com.docker.compose.project=deadly-drops >/dev/null
# a dedicated server: also drop build cache older than a week, or every deploy grows the disk
if [ "$own_proxy" = 1 ]; then
  docker builder prune -f --filter until=168h >/dev/null || true
fi
echo "Deployed."
