#!/usr/bin/env bash
# Nightly backup of the Deadly Drops database and uploaded images, on the VPS.
# deploy.sh copies this file to /root/deadly-drops/backup.sh. Install it once
# with `crontab -e` as root:
#   15 3 * * * /root/deadly-drops/backup.sh >> /root/deadly-drops/backups/backup.log 2>&1
#
# Writes backups/ddp-<UTC>.dump (pg_dump custom format) and
# backups/uploads-<UTC>.tar.gz, keeping the newest 14 of each. These sit on the
# same disk as the data: copy them off the server too.
#
# Restore the database (the site is down while it runs), in /root/deadly-drops:
#   docker compose stop web
#   docker compose exec -T db pg_restore -U ddp -d ddp --clean --if-exists --no-owner \
#     --single-transaction < backups/ddp-YYYYMMDDTHHMMSSZ.dump
#   docker compose start web
# Restore the images:
#   tar -xzf backups/uploads-YYYYMMDDTHHMMSSZ.tar.gz -C data && chown -R 1000:1000 data
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin   # cron's PATH is minimal
umask 077   # backups hold the whole database: owner-only files

# One run at a time (the cleanup trap below must not delete another run's .partial files)
exec 9>/var/lock/ddp-backup.lock
flock -n 9 || { echo "$(date -u +%FT%TZ) another backup is still running, skipping"; exit 1; }

DIR=/root/deadly-drops
OUT="$DIR/backups"
KEEP=14
TS="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$OUT"
# Write to .partial and rename on success, so a failed run never leaves a
# truncated file that would count toward the 14 kept
trap 'rm -f "$OUT"/*.partial' EXIT

docker compose -f "$DIR/docker-compose.yml" exec -T db pg_dump -U ddp -Fc ddp > "$OUT/ddp-$TS.dump.partial"
mv "$OUT/ddp-$TS.dump.partial" "$OUT/ddp-$TS.dump"

tar -czf "$OUT/uploads-$TS.tar.gz.partial" -C "$DIR/data" uploads
mv "$OUT/uploads-$TS.tar.gz.partial" "$OUT/uploads-$TS.tar.gz"

# Names sort by time, so the newest come first in reverse order
for pattern in 'ddp-*.dump' 'uploads-*.tar.gz'; do
  find "$OUT" -maxdepth 1 -type f -name "$pattern" -printf '%f\n' | sort -r | tail -n +$((KEEP + 1)) |
    while read -r f; do rm -f -- "$OUT/$f"; done
done

echo "$(date -u +%FT%TZ) ok ddp-$TS.dump ($(du -h "$OUT/ddp-$TS.dump" | cut -f1)), uploads-$TS.tar.gz ($(du -h "$OUT/uploads-$TS.tar.gz" | cut -f1))"
