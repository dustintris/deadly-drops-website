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
| P4 | On-site screens: venue screen `/display/<slug>/` (courts now/next + divisions rotating, `?division=`, `?day=`, `?rotate=`), check-in desk `/admin/checkin/<id>/`, printable results `/display/<slug>/print/` | built, deploys on push |
| P5 | Medals = top 3 of the final standings (same rule as the desktop app) on page/board/print; desktop app download API `GET /api/tournaments[/<id>]` (bearer key from Admin → Desktop app, the app's own import format) | built, deploys on push |
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
- Desktop app = `dustintris/DeadlyDropsPickleBall` (Electron + NestJS registration server). It has no playoffs either.
  The website serves its download contract (`src/lib/appsync/`); the key is stored hashed in `app_meta`. Teams with
  one player are left out (the app needs exactly two) and listed on the admin page. App "publish" (POST) is 405.
- Later: real playoff brackets (division `playoffs` top4/top8 is saved but not run; medals come from standings), and
  porting the app server's online registration + signed QR tickets + QR check-in.
- Results UI is shared in `src/components/results/Results.tsx` (page, board, print) and `src/lib/match/present.ts`.
- Check-in times/who are staff-only: public reads go through `publicPlay()` (`src/lib/data.ts`), which blanks them.
- **Deploying is automatic**: every push to `main` or `ccr-fffcb32a-715c27` that touches `web/` or `deploy/vps/`
  runs GitHub Actions `deploy-vps` (typecheck + tests, then deploy). Watch it in GitHub → Actions; re-run or
  "Run workflow" by hand there. The deploy key can only run `/root/deadly-drops/ci-deploy.sh` on the VPS. A
  cloud/phone session just commits and pushes to that branch. Laptop fallback: `bash deploy/vps/deploy.sh`.
