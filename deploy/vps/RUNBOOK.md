# Deadly Drops: server runbook

https://ddptournaments.com runs on a dedicated VPS (`root@179.66.153.48`, Ubuntu) as three containers from
`docker-compose.standalone.yml`: **caddy** (HTTPS), **web** (Next.js) and **db** (PostgreSQL 18). Only Caddy is
reachable from outside (ports 80/443). The database sits on a private network with no way in or out.

Unless noted otherwise, run commands as root in `/root/deadly-drops` on the server. That folder's `.env` sets
`COMPOSE_FILE`, so a plain `docker compose ...` there picks the right file: don't pass `-f`.

> **The old server.** Until it is retired, `ssh smj` still serves https://ddptournament.com from the same scripts,
> with `docker-compose.yml` behind a shared Caddy proxy that other projects own (on its external Docker network).
> Its `.env` sets none of `COMPOSE_FILE`/`SITE_DOMAIN`/`SITE_URL`. Deploys, rollback, backups,
> logs and the password reset work the same there. The Caddy, certificate, DNS and rebuild parts don't apply.

## Where things live

| Path (in `/root/deadly-drops`) | What |
|---|---|
| `app/` | The uploaded `web/` source; the image is built from it. Every deploy replaces it, so don't edit it. |
| `data/uploads/` | Uploaded images, mounted at `/data` in **web** and owned by uid 1000 (the image's `node` user). |
| `backups/` | Nightly `ddp-<UTC>.dump` and `uploads-<UTC>.tar.gz` (newest 14 of each) and `backup.log`. |
| `.env` | Secrets and this server's settings (chmod 600). See `deploy/vps/.env.example`. |
| `docker-compose.standalone.yml` | This server's stack. `docker-compose.yml` is the shared-server variant (unused here). |
| `Caddyfile` | HTTPS for `SITE_DOMAIN`, `www.` redirect, proxy to **web**. |
| `server-steps.sh`, `backup.sh`, `ci-deploy.sh` | Build and start; nightly backup; the CI key's forced command. |

The Docker volumes are `deadly-drops_pgdata` (the database) and `deadly-drops_caddy_data` (certificates). The
images are `deadly-drops-web:latest` (running) and `deadly-drops-web:previous` (the one before). `docker compose down`
keeps the volumes. **`docker compose down -v` deletes the database.**

## How deploys work

- **GitHub Actions** (`.github/workflows/deploy-vps.yml`) runs on every push to `main` or the working branch (the
  `branches:` list there) that touches `web/`, `deploy/vps/` or the workflow. It runs the checks (typecheck, tests),
  then pipes a tar of `web/` + `deploy/vps/` to `ssh root@$VPS_HOST`. That key may only run `ci-deploy.sh`, which
  unpacks the bundle, swaps in `app/`, copies the compose files, `Caddyfile` and scripts, then runs `server-steps.sh`.
  The script builds the image, runs `docker compose up -d` and waits up to 90 s for **web** to report healthy. Last,
  the workflow checks the live pages. Watch it under GitHub → Actions → *deploy-vps*; *Run workflow* there
  redeploys by hand.
  **CI deploys to one server only**: the one `VPS_HOST` names.
- **From a laptop** with root ssh access, from the repo root in Git Bash: `bash deploy/vps/deploy.sh` (this
  server) or `DEPLOY_HOST=smj bash deploy/vps/deploy.sh` (the old one). It runs the tests locally, uploads, and is
  the only thing that installs or updates `ci-deploy.sh`. A change to that file needs one laptop deploy per server.
- Deploys take `/var/lock/ddp-deploy.lock`, so two never overlap. Migrations run when **web** starts.
- **Caddyfile changes:** a deploy reloads Caddy gracefully (`caddy reload`) after `up -d`, so they take effect with
  no downtime. By hand: `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`.
- Each deploy also pulls newer patch releases of `postgres:18-alpine` and `caddy:2-alpine` (and the `node:24-slim`
  base with `build --pull`), and drops Docker build cache older than a week.
- **A failed CI deploy** keeps the container logs off the public Actions log: they are in
  `/root/deadly-drops/deploy-fail.log` on the server. A laptop deploy (`deploy.sh`) prints them directly.
- On the server, `docker compose ps` shows the state and health; `docker compose logs -f web` follows a start-up.

## Roll back the code

```sh
docker tag deadly-drops-web:previous deadly-drops-web:latest && docker compose up -d web
```

This goes back one release only, and it does not undo database migrations. Also revert the bad commit and push,
or the next deploy brings it back.

## Backups and restore

`backup.sh` runs nightly from cron (03:15 server time). It writes `backups/ddp-<UTC>.dump` (pg_dump custom format)
and `backups/uploads-<UTC>.tar.gz`, keeps the newest 14 of each and logs to `backups/backup.log`. Run
`./backup.sh` to make one now, for example before a risky change.

Restore the database (the site is down while it runs):

```sh
docker compose stop web
docker compose exec -T db pg_restore -U ddp -d ddp --clean --if-exists --no-owner \
  --single-transaction < backups/ddp-YYYYMMDDTHHMMSSZ.dump
docker compose start web
```

Restore the images:

```sh
tar -xzf backups/uploads-YYYYMMDDTHHMMSSZ.tar.gz -C data && chown -R 1000:1000 data
```

To take backups from another server (say the old one), copy them from a laptop:
`scp -3 smj:/root/deadly-drops/backups/ddp-YYYYMMDDTHHMMSSZ.dump root@179.66.153.48:/root/deadly-drops/backups/`
(the same for the `uploads-` file). For a fresh copy, run `./backup.sh` there first.

## Rebuild a server from scratch

1. **Ubuntu VPS**, with root ssh access by key.
2. **Docker** Engine and the Compose plugin: https://docs.docker.com/engine/install/ubuntu/. Check with
   `docker compose version`.
3. **Swap**, so `next build` survives a small server (skip if `swapon --show` already lists some):
   ```sh
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```
4. **Firewall**: ssh and the web only. Allow your ssh port before enabling, or you lock yourself out:
   ```sh
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
   ```
   Docker's published ports skip ufw, which is why the compose file publishes nothing but Caddy's 80/443.
5. **`.env`**: run `mkdir -p /root/deadly-drops` on the server, then `scp deploy/vps/.env.example
   root@<IP>:/root/deadly-drops/.env` from the laptop. Fill it in on the server (comments in the file).
   `POSTGRES_PASSWORD` must be set before the first start.
6. **DNS**: A records for `@` and `www` pointing at the server (see DNS below). Wait until
   `dig +short ddptournaments.com` shows the new IP.
7. **Deploy** from the laptop: `DEPLOY_HOST=root@<IP> bash deploy/vps/deploy.sh` (the default host is
   179.66.153.48). This also installs `ci-deploy.sh`. Caddy gets the certificates on first start.
8. **Restore** the newest database dump and uploads (Backups and restore above).
9. **Cron**: `crontab -e` as root and add
   ```
   15 3 * * * /root/deadly-drops/backup.sh >> /root/deadly-drops/backups/backup.log 2>&1
   ```
10. **CI key**: make a key pair for GitHub Actions only, e.g. `ssh-keygen -t ed25519 -N '' -f ddp-ci -C ddp-ci`.
    Add the public half to `/root/.ssh/authorized_keys` on the server as one line:
    ```
    restrict,command="/root/deadly-drops/ci-deploy.sh" ssh-ed25519 AAAA... ddp-ci
    ```
    Then in GitHub → Settings → Secrets and variables → Actions, set:
    - `VPS_HOST`: the server's IP
    - `VPS_SSH_KEY`: the private half (then delete the local copy)
    - `VPS_KNOWN_HOSTS`: the output of `ssh-keyscan -t ed25519 <IP>`. Compare its fingerprint with
      `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server.
11. **Check**: `curl -sI https://ddptournaments.com`, log in at `/admin`, and run *Run workflow* once to prove
    that CI can deploy.

## Certificates

Caddy gets Let's Encrypt certificates for `SITE_DOMAIN` and `www.SITE_DOMAIN` on first start and renews them by
itself before they expire. There is no cron job and nothing to do. They need DNS pointing here and ports 80 and 443
open. Certificates persist in the `deadly-drops_caddy_data` volume, so a rebuild of the containers doesn't request
new ones (Let's Encrypt rate-limits repeats). The `uptime` workflow fails once a certificate has 14 days or fewer
left, which means renewal is failing. To check: `docker compose logs caddy | grep -iE 'certificate|error'`.

## Logs

```sh
docker compose logs --tail=200 web     # the app; also caddy, db
docker compose logs -f web             # follow
docker compose ps                      # state and health
tail -n 20 backups/backup.log          # nightly backups
```

Container logs are capped at 3 × 10 MB each. Caddy keeps no access log (the Caddyfile has no `log` directive), so
its log holds certificate and error messages only. Deploy output is in the GitHub Actions run, or in your terminal for
`deploy.sh`.

## Owner password reset

The owner login comes from `.env`; staff passwords are reset in the admin (Staff).

1. On a laptop with the repo: `cd web && npm run admin:setup`. It writes `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` to
   `web/.env.local`, with each `$` written as `\$`.
2. On the server, put the hash in `.env`. Remove the backslashes and wrap the hash in single quotes:
   `ADMIN_PASSWORD_HASH='scrypt$<salt>$<hash>'`.
3. `docker compose up -d web`. This recreates the container with the new value and signs the owner out everywhere.

## DNS (Hostinger)

`ddptournaments.com`'s DNS is managed in Hostinger's hPanel (Domains → ddptournaments.com → DNS / Nameservers). It
needs:

- `A @ → 179.66.153.48`
- `A www → 179.66.153.48` (or `CNAME www → ddptournaments.com`)

Delete Hostinger's default parking records for `@`/`www`, and any `AAAA` record that doesn't point at this server.
Let's Encrypt tries IPv6 first, so a stray `AAAA` blocks the certificates, and IPv6 visitors would land somewhere
else. If there is a `CAA` record, it must allow `letsencrypt.org`. Lower the TTL (e.g. 300) a day before moving
servers.

## Not covered yet

- **Off-site backups.** `backups/` sits on the same disk as the data, so losing the server loses both. Until
  something copies them off automatically (e.g. restic or rclone to object storage, or VPS snapshots), copy the
  newest pair to a laptop now and then:
  `scp root@179.66.153.48:/root/deadly-drops/backups/ddp-YYYYMMDDTHHMMSSZ.dump .`
- No alerts for the database, disk space or failed backups. The `uptime` workflow
  (`.github/workflows/uptime.yml`) only checks the public pages and certificates every 15 minutes, and GitHub
  emails when a run fails. Check `backups/backup.log` and `df -h` now and then.
