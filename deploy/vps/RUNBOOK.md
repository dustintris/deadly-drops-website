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
| `downloads/desktop/` | The desktop app's update feed and installers (see Desktop app releases). Read-only in **caddy** and **web**. |
| `backups/` | Nightly `ddp-<UTC>.dump` and `uploads-<UTC>.tar.gz` (newest 14 of each) and `backup.log`. |
| `.env` | Secrets and this server's settings (chmod 600). See `deploy/vps/.env.example`. |
| `docker-compose.standalone.yml` | This server's stack. `docker-compose.yml` is the shared-server variant (unused here). |
| `Caddyfile` | HTTPS for `SITE_DOMAIN`, `www.` redirect, the gated `/downloads/desktop/`, proxy to **web**. |
| `server-steps.sh`, `backup.sh`, `ci-deploy.sh` | Build and start; nightly backup; the CI key's forced command. |
| `receive-desktop-release.sh` | Puts a desktop-app release live: the desktop release key's forced command. |
| `desktop-update-signing.pub.pem` | The public half of the desktop release signing key; the receiver checks each release with it. |

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

## Desktop app releases

The club's Windows app (desktop repo `dustintris/DeadlyDropsPickleBall`, `apps/desktop`) is downloaded from this
server, and its copies update themselves from here. Downloads and updates are both for the club only: see Gating.

**Releasing.** Raise `version` in `apps/desktop/package.json` and merge to `main`; that's all. The desktop repo's
`.github/workflows/release-desktop.yml` stops if the tag `desktop-v<version>` already exists, else builds the
installer on Windows, signs `latest.yml` in a separate job (see The signing key), pipes `latest.yml`,
`DeadlyDropsPickleball-Setup-<version>.exe` and its `.blockmap` as a tar over ssh to `root@VPS_HOST`, then pushes
the tag. That key may only run `receive-desktop-release.sh`, which puts the release live, or refuses it, and prints
why in the Actions log:

- the upload must arrive within 15 minutes, 600 MB at most: only those files, plain and at the top level, none
  unpacking to more than that (a sparse entry is caught before it touches the disk);
- `latest.yml`'s version (X.Y.Z), path and its one file entry (name, sha512, size) must match the installer, and
  its `ddpSignature` line must verify with the release key's public half (`desktop-update-signing.pub.pem`);
- the version must be above the live one. The same version and the same build again: "already live", exit 0
  (a re-run is harmless). The same version built again (another sha512), or a lower one: refused.
- The installer and blockmap go in first and `latest.yml` last (a rename each), so the feed never names a missing
  file. The three newest installers (by version) stay, with their blockmaps, so copies one or two versions
  behind update with a small differential download. Older ones are deleted.

**Laptop fallback** (CI broken, or a release to put back), from this repo's root in Git Bash, with root ssh access:
`bash deploy/vps/publish-desktop.sh <the desktop repo's apps/desktop/release>`. Sign `latest.yml` first with the
desktop repo's sign script (it adds the `ddpSignature` line and needs the signing key); an unsigned one is refused
before anything is sent. It sends the newest installer there, which `latest.yml` must name, to the same receiver
over normal ssh (the host defaults to `root@179.66.153.48`; pass another as a second argument).

**Where the files live.** `/root/deadly-drops/downloads/desktop/`: `latest.yml` (the feed), the installers and
their blockmaps; also the receiver's dot-named temp files and `.release.lock`, which are never served. Each deploy
creates the folder if needed and sets it root-owned, folders 755 and files 644 (Caddy has no `CAP_DAC_OVERRIDE`,
and the app runs as uid 1000), and deletes nothing in it. **web** reads `latest.yml` (`DOWNLOADS_DIR=/downloads`) to
show the live version in the admin.

**Gating.** `https://ddptournaments.com/downloads/desktop/<file>`: before Caddy serves a file, it asks the app
(`/api/desktop/download-check/`, with the request's cookies and `Authorization` header). A signed-in staff member
(the browser) or an activated copy's key (the updater) gets the file; anyone else gets 401/403. Any other
`/downloads/` path is a 404, and with **web** down they all fail (502) rather than open up. Range requests work
(resumed and differential downloads); `latest.yml` is never cached. To check: `curl -sI
https://ddptournaments.com/downloads/desktop/latest.yml` answers 401. Activation codes are made in Admin → Desktop
app; the app keeps them keyed with `DESKTOP_CODE_SECRET` in `.env`, which the first deploy makes. Keep it: a new
one voids the codes not used yet (activated copies keep working).

**Backups.** The downloads are not in the nightly backup: they can be built again. After losing the server, build
the live version from its tag (`desktop-v<version>`) in the desktop repo and publish it with `publish-desktop.sh`
(CI skips a version that already has its tag), or copy the folder over from the old disk if it survived.

**Rolling back.** Fix forward: installed copies never move to a lower version, and the receiver refuses one. Revert
the bad change in the desktop repo, raise the version above the bad one (after a bad 0.7.0, release 0.7.1), merge,
and every copy updates to it. To stop more copies updating to a bad release while the fix is built, move the feed
aside on the server: `mv downloads/desktop/latest.yml downloads/desktop/.latest.yml.paused`. Updaters then find no
update, and the next release (any version) puts a new feed in place.

**A wrong, too-high version** (say `99999.0.0` went out by mistake) blocks every later release: the receiver
refuses anything below the live version. Reset it by hand on the server, in `/root/deadly-drops`:

```sh
mv downloads/desktop/latest.yml downloads/desktop/.latest.yml.bad   # no feed: the next release may be any version
rm downloads/desktop/DeadlyDropsPickleball-Setup-99999.0.0.exe downloads/desktop/DeadlyDropsPickleball-Setup-99999.0.0.exe.blockmap
```

Then put the right version in `apps/desktop/package.json` (one with no `desktop-v` tag yet) and merge, or publish it
from a laptop. Copies that already installed the wrong version never move down: reinstall those by hand from the
website's download.

**The signing key.** Each release's `latest.yml` carries a `ddpSignature:` line, an ed25519 signature over its
version, file name, sha512 and size. The desktop repo's CI adds it in the publish job (never in the build job,
which runs dependency code) with the repo secret `DESKTOP_SIGNING_KEY`, the private key as PKCS8 PEM. The public
half is baked into the app and is on this server as `desktop-update-signing.pub.pem` (from `deploy/vps/`, put in
place by each deploy). The receiver refuses a release that doesn't verify, and the app downloads and installs only
an update whose signature and file match. So a stolen ssh key, or a changed file on this server, can't push an
update to installed copies. (A first download from the website is a plain file, though: guard the server too.)

- **Keep an offline backup of the private key** (e.g. in the password manager). If it's lost, installed copies
  can't accept any update until each is reinstalled by hand with a build that carries a new public key.
- **Rotating it:** release a version signed with the old key that ships the new public key in the app. Once every
  copy runs that version, put the new public half in `deploy/vps/desktop-update-signing.pub.pem` (and deploy) and
  the new private key in `DESKTOP_SIGNING_KEY`, then release again. A copy still on an older version then refuses
  every update and needs reinstalling by hand.
- The receiver checks signatures with OpenSSL 3 (`openssl version` on the server; Ubuntu 22.04 and later have it).
  With an older one it refuses every release rather than skip the check.

**One-time setup** (once per server). The receiver comes with each deploy, but the first must be a laptop deploy
(`deploy.sh`): only that updates `ci-deploy.sh`, which CI deploys need before they copy the receiver too. Then:

1. Make a key pair for the desktop repo's CI only: `ssh-keygen -t ed25519 -N '' -f ddp-desktop-release -C
   ddp-desktop-release`.
2. Add the public half to `/root/.ssh/authorized_keys` on the server as one line:
   ```
   restrict,command="/root/deadly-drops/receive-desktop-release.sh" ssh-ed25519 AAAA... ddp-desktop-release
   ```
   `restrict` means no shell, no forwarding and no terminal. Whatever command the client asks for, this key runs
   the receiver with no arguments, and the receiver reads only the tar on stdin.
3. In GitHub → `dustintris/DeadlyDropsPickleBall` → Settings → Secrets and variables → Actions, set:
   - `DESKTOP_PUBLISH_KEY`: the private half (then delete the local copy)
   - `DESKTOP_SIGNING_KEY`: the release signing key (PKCS8 PEM) whose public half is
     `deploy/vps/desktop-update-signing.pub.pem` (see The signing key; keep its offline backup)
   - `VPS_HOST`: the server's IP
   - `VPS_KNOWN_HOSTS`: the output of `ssh-keyscan -t ed25519 <IP>`. Compare its fingerprint with
     `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server.

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
11. **Desktop releases**: the release key and its GitHub secrets (Desktop app releases, One-time setup), then
    put the live desktop version back (Desktop app releases, Backups).
12. **Check**: `curl -sI https://ddptournaments.com`, log in at `/admin`, and run *Run workflow* once to prove
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
