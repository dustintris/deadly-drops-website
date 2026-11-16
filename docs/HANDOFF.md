# DDP Tournaments — build handoff (2026-11-16)

Client contract "DDP Tournaments: website and web app": the Next.js app in `web/`, live at
https://ddptournament.com. Read `web/README.md` first (setup, tests, deploy, code map).

## Status

| Phase | What | State |
|---|---|---|
| P0 | PostgreSQL (Drizzle) + Docker deploy on the VPS, content store in Postgres, nightly backups | live |
| P1 | Staff logins with per-area access (none/view/edit), owner from server env | live |
| P2 | Tournaments in the DB: days (multi-day), divisions, game rules, per-tournament logo, public page per tournament | live |
| P3 | Pickle Match scoring: engine (`src/lib/match`), teams/schedule/scores (`src/lib/play/repo.ts`), live SSE `/live/<id>/`, score pad, live standings | live |
| P4 | On-site screens in the web app: full-screen projector board (`/display/<slug>`), check-in desk (`/admin/checkin/<id>`), printable results | next |
| P5 | Playoffs (top 4 / top 8 brackets from pool standings, bronze match or from standings) + medals on board, page, print | todo |
| P6 | Logo upload in the admin (theme.logo) replacing the hard-coded `/logo.png`; themeColor from the theme | todo |
| P7 | Handover: README runbook (tournament day, hotspot, offline fallback), final review, deploy | todo |

## Decisions already made with the client/owner
- PostgreSQL for everything; uploaded images on a disk volume.
- On tournament day the owner's laptop runs the projector board and check-in **in Chrome** on a phone hotspot;
  the Electron Pickle Match app stays installed unchanged as an offline backup (no sync). A desktop live link is a
  possible paid add-on later.
- Scorekeepers use staff logins (Scorekeeper preset), no anonymous court links.
- Medal matches assumed to be one game to `rules.playoffGamesTo`; best-of-3 would be a change request.
- Brand logo = round oni badge (`web/public/logo.png`); every tournament can have its own logo (`info.logo`).

## Working rules
- Commit messages: plain, authored by the owner's git identity only. **No `Co-Authored-By` or other AI attribution
  lines** in commits or PR descriptions.
- Test-first; `npm test` (Vitest + throwaway embedded PostgreSQL), `npm run typecheck`; build must work without a DB.
- Review each phase with ECC reviewer agents (security / database / code / react) before deploying.
- Teams/matches link to divisions with NO ACTION FKs; scoring bumps `tournaments.live_version` + `pg_notify('ddp_live')`.

## Open items
- **Prod admin has no owner yet**: the owner must run `npm run admin:setup` and put `ADMIN_EMAIL` and
  `ADMIN_PASSWORD_HASH` (single-quoted) into `/root/deadly-drops/.env` on the VPS, then redeploy/restart.
- P3 review nits for P4: `ScoreBoard` closePad should only close the pad for the match it opened; a live refresh
  that removes the open match unmounts `ScorePad` without keeping the typed score.
- **Deploying is automatic**: every push to `main` or `ccr-fffcb32a-715c27` that touches `web/` or `deploy/vps/`
  runs GitHub Actions `deploy-vps` (typecheck + tests, then deploy). Watch it in GitHub → Actions; re-run or
  "Run workflow" by hand there. The deploy key can only run `/root/deadly-drops/ci-deploy.sh` on the VPS. A
  cloud/phone session just commits and pushes to that branch. Laptop fallback: `bash deploy/vps/deploy.sh`.
