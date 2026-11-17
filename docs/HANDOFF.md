# DDP Tournaments — build handoff (2026-11-17)

Client contract "DDP Tournaments: website and web app": the Next.js app in `web/`, live at
https://ddptournament.com. Read `web/README.md` first (setup, tests, deploy, code map, tournament-day runbook).

## Status: every contract item is built

| Phase | What | State |
|---|---|---|
| P0 | PostgreSQL (Drizzle) + Docker deploy on the VPS, content store in Postgres, nightly backups | live |
| P1 | Staff logins with per-area access (none/view/edit), owner from server env | live |
| P2 | Tournaments in the DB: days (multi-day), divisions, game rules, per-tournament logo, public page per tournament | live |
| P3 | Pickle Match scoring: engine (`src/lib/match`), teams/schedule/scores (`src/lib/play/repo.ts`), live SSE `/live/<id>/`, score pad, live standings | live |
| P4 | On-site screens: venue screen `/display/<slug>/` (courts now/next + divisions rotating, `?division=`, `?day=`, `?rotate=`), check-in desk `/admin/checkin/<id>/`, printable results `/display/<slug>/print/` | live |
| P5 | Playoff brackets: top 4 (1v4, 2v3) / top 8 (1v8, 4v5, 2v7, 3v6) drawn by themselves when a division's last pool game goes final, winners moved on as games finish, bronze match or bronze from the standings; bracket + medals on page/board/print; Draw/Reset on the Play page. Plus the desktop app download API `GET /api/tournaments[/<id>]` (bearer key, Admin → Desktop app) | live |
| P6 | Club logo upload (Admin → Logo & colours, `theme.logo`): header, footer, admin, login, venue screen/print fallback, favicon, OpenGraph, JSON-LD; `themeColor` from the theme | live |
| P7 | Handover: README runbook (tournament day, hotspot, offline fallback, deploy/rollback/backups), ECC reviews | done |

## Decisions already made with the client/owner
- PostgreSQL for everything; uploaded images on a disk volume.
- On tournament day the owner's laptop runs the projector board and check-in **in Chrome** on a phone hotspot;
  the Electron Pickle Match app stays installed unchanged as an offline backup (no sync). A desktop live link is a
  possible paid add-on later.
- Scorekeepers use staff logins (Scorekeeper preset), no anonymous court links.
- Medal matches assumed to be one game to `rules.playoffGamesTo`; best-of-3 would be a change request.
- Brand logo = round oni badge (`web/public/logo.png`, the fallback); the owner can upload a new one; every
  tournament can have its own logo (`info.logo`).

## How playoffs work (for whoever changes them)
- Pure engine: `src/lib/match/bracket.ts` (plan, seeding, `resolveBracket`, medals). Presentation in
  `src/lib/match/present.ts` + `src/components/results/Results.tsx` (`Bracket`).
- `saveScore` calls `syncBracket` in the same transaction whenever a game goes final or a final game is reopened:
  it draws the bracket when the pool completes, fills/empties later games, and refuses (rolls back) a correction
  that would change a game already under way (`BracketStartedError`). Only pool results can re-seed; a playoff
  result never does. One playoff game per slot is enforced by the unique index `matches_playoff_slot_idx`.
- A division set to top 8 with fewer than 8 teams can't draw: it's treated as having no playoffs (standings medals).
- Changing a division's playoff format is refused while its bracket is drawn (`PlayoffsDrawnError`); reset first.
- Locking: every play write locks the tournament row first, then division, then matches (same order as the editor).

## Working rules
- Commit messages: plain, authored by the owner's git identity only. **No `Co-Authored-By` or other AI attribution
  lines** in commits or PR descriptions.
- Test-first; `npm test` (Vitest + throwaway embedded PostgreSQL), `npm run typecheck`; build must work without a DB.
- Review each phase with ECC reviewer agents (security / database / code / react) before deploying.
- Teams/matches link to divisions with NO ACTION FKs; scoring bumps `tournaments.live_version` + `pg_notify('ddp_live')`.

## Open items
- The owner login is set on the VPS (from the owner's `web/.env.local`). A new password: `npm run admin:setup`,
  put the hash (single-quoted) into `/root/deadly-drops/.env`, `docker compose up -d web`.
- Desktop app = `dustintris/DeadlyDropsPickleBall` (Electron + NestJS registration server). The website serves its
  download contract (`src/lib/appsync/`); the key is stored hashed in `app_meta`. Teams with one player are left
  out (the app needs exactly two) and listed on the admin page. App "publish" (POST) is 405.
- Later (not in the contract): porting the app server's online registration + signed QR tickets + QR check-in; a
  live desktop link.
- Check-in times/who are staff-only: public reads go through `publicPlay()` (`src/lib/data.ts`), which blanks them.
- VPS leftovers safe to delete by hand: `/root/deadly-drops/www` and `nginx.conf` (old static site).
- **Deploying is automatic**: every push to `main` or `ccr-fffcb32a-715c27` that touches `web/` or `deploy/vps/`
  runs GitHub Actions `deploy-vps` (typecheck + tests, then deploy). Watch it in GitHub → Actions; re-run or
  "Run workflow" by hand there. The deploy key can only run `/root/deadly-drops/ci-deploy.sh` on the VPS. A
  cloud/phone session just commits and pushes to that branch. Laptop fallback: `bash deploy/vps/deploy.sh`.
