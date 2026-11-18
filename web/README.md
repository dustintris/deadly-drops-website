# Deadly Drops Pickleball: website + owner admin (MIS)

Next.js 16 / React 19 / TypeScript. Public site in `src/app/(site)`, owner admin in `src/app/admin`.

```
cd web
npm install
npm run admin:setup   # once: creates .env.local with the owner email, password hash and session secret
                      # then add DATABASE_URL from .env.example to .env.local
npm run db:dev        # local PostgreSQL 18 (no Docker needed); leave it running in its own terminal
npm run dev           # http://localhost:3000, admin at http://localhost:3000/admin/
npm test              # Vitest; database tests start their own throwaway PostgreSQL
npm run build && npm start
```

Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`.
Migrations apply automatically when the server starts.

## Public pages

| Page | Route |
|---|---|
| Home: next tournament (live score card on tournament day), upcoming tournaments in full, how tournaments work, past results, the charities | `/` |
| Tournaments (season, format, divisions, registration) | `/tournaments` |
| One tournament: days, divisions, fees, rules, then live standings, schedule, playoff bracket and medals, and the charity it plays for | `/tournaments/[slug]` |
| Charity: each charity the tournaments play for, with its story, flyer, website and tournaments (anchor `#<slug>`) | `/charity` |
| Venue screen for the projector (full screen, live, rotates divisions) | `/display/[slug]` |
| Printable results | `/display/[slug]/print` |
| Community: news, articles, photo stories, community photos | `/community`, `/community/[slug]` |
| About us | `/about` |
| Shop and product: a catalogue (no online checkout); each product says how to buy and links to Contact | `/shop`, `/shop/[slug]` (`/cart` redirects to `/shop`) |
| Gallery with lightbox | `/gallery` |
| Contact (messages go to Admin → Inbox; `?about=<product>` starts a shop order) | `/contact` |

The members directory, player log in / sign up and "My play" ran on sample data, so they answer "not found" until
real member accounts exist (the components are still in `src/components`). The footer's "Join the list" saves the
address to the email list in Admin → Inbox.

## Owner admin (MIS)

Sign in at `/admin/`. Every change is saved as a **draft**; **Preview site** shows the draft, **Publish** puts it live
(no rebuild), **Discard** goes back to what is live. The last 20 published versions are kept in the database
(`site_history`).

**Staff logins.** The owner (the server's `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`) can do everything, can't be locked
out, and creates a login for each helper under **Staff**, picking a role (Manager, Tournament director, Scorekeeper,
Check-in desk, Content editor) or setting *no access / view only / can change* per area: tournaments, scoring,
check-in, website content, shop, logo & colours, staff. People only see the screens they can view; a view-only
screen is read-only; Publish and Discard only touch the sections the person can change. Changes to someone's access
apply at once; disabling a login signs that person out everywhere. Everyone changes their own password under
**My account** (the owner's password is changed on the server with `npm run admin:setup` + restart). Only the owner
can give access to staff accounts, and nobody can hand out access they don't have themselves.

| Screen | What the owner changes |
|---|---|
| Tournaments | name, web address, one or more days, location, fees, prizes, what's included, registration open + link, poster and the tournament's own logo, featured, shown/hidden; divisions (format, day, start time, courts, minutes per round, team limit, games, playoffs top 4/top 8, bronze match or from standings); game rules and rule notes. Saved changes are live at once; a hidden tournament is the draft |
| Teams & schedule (per tournament) | paste or type each division's teams, make the round-robin schedule, draw or reset the playoffs |
| Scoring | phone-first score pad for every match, live to every screen within a second |
| Check-in | tap players in at the desk; several devices stay in step |
| Desktop app | the key that lets the Pickle Match desktop app download tournaments and teams (owner only) |
| Inbox | messages from the Contact page (reply by email, mark as dealt with, delete) and the email list (download as CSV, remove an address). Needs website content access. Each address can send 5 of each an hour, the whole site 200 |
| Announcements | the top bar and the homepage ticker |
| Shop & prices | products, prices, stock (sold out / only N left), options, up to 6 photos each, visibility |
| Photos | upload (resized in the browser, JPEG/PNG/WebP, 5 MB max), descriptions, see where each photo is used, delete unused |
| Community & news | news, articles, photo stories with a simple formatting language, cover + photo sets, draft/published, featured |
| Charities | name, tagline, card summary, full story (same formatting as posts), website, logo, flyer, and which tournaments play for each one: shown on the Charity page, the home page and those tournaments' pages |
| Gallery | photos, captions, albums (Community/Socials photos also appear on the Community page) |
| Page text | headline, intro and main photo for Home, About, Community, Shop, Gallery, Contact |
| Club info | contact details, about text and points, how-it-works steps, favourites, social links, member discount |
| FAQ | questions on the Contact page |
| Logo & colours | club logo (header, footer, admin, venue screen and printed results when a tournament has none, tab icon, link preview; the bundled badge when empty) and brand colours with presets; saving is blocked if any text would be hard to read (WCAG 4.5:1) |

Security: scrypt password hashes, HttpOnly SameSite=Strict session cookie (8 h) holding a random token whose SHA-256
is stored in `sessions` (sign out = delete the row), login throttling, every page, server action and route checks the
session and the person's access for that area, same-origin check and an hourly limit on uploads, server-side validation (zod) of every save,
uploads checked by file content with random names and served with `nosniff`, admin pages not indexed or framed,
audit log in the database (`audit_log`).

## Tournament day

**Before the day**
1. Admin → Tournaments: check the days, each division's day, start time, courts and team limit, the game rules,
   and the playoffs (none, top 4 or top 8; bronze match or bronze from the standings). Tick *Show on the website*.
2. Teams & schedule: paste each division's teams straight from the registration spreadsheet (one team per row:
   team name, player, DUPR, player, DUPR; or one player per row, paired up), check them, **Save teams**, then
   **Make schedule**. Until the first score, the schedule can be made again or cleared to change the teams.
3. Staff: give each volunteer a login with the *Scorekeeper* role (scores only) and the desk a *Check-in desk*
   login. They sign in on their own phones; nobody shares the owner login.
4. Optional: Desktop app → make a key and download the tournament into the Pickle Match desktop app on the laptop,
   as the offline backup (it does not sync back).

**On the day** (laptop on a phone hotspot, volunteers on their own data)
- Projector: open `/display/<slug>/` (Teams & schedule → *Venue screen*), drag it to the projector, press
  **Full screen**. Courts show what's live and next; standings rotate through the divisions. Options:
  `?rotate=30` (seconds per division), `?division=<id>` (one division, e.g. a second screen), `?day=2`.
- Check-in desk: Admin → Check-in: search a name, tap to check players in (or undo); every desk device stays in step.
- Scorekeepers: Admin → Scoring → the tournament → tap a match. +/− or type the score and **Save**;
  **Finish game** only accepts a finished game (games to N, win by 2 if set). **Time cap** ends a game early;
  **Reopen game** corrects a finished one. If two phones score the same game, the second gets the current
  score back instead of overwriting it.
- Playoffs draw themselves the moment the last pool game of a division is final: top 4 = 1 v 4 and 2 v 3; top 8 =
  1 v 8, 4 v 5, 2 v 7, 3 v 6. Winners move on by themselves; playoff games are played to *Playoff points to win*.
  A pool or playoff result can be corrected until the game it feeds has started; after that, clear that game's
  score first. To change the playoff format after the draw: Teams & schedule → **Reset playoffs** (only while no
  playoff game has a score), change it in the tournament, then **Draw playoffs**.
- Medals appear on the page, the venue screen and the print as soon as each is decided (gold and silver from the
  final, bronze from the bronze match or the higher pool finisher of the semifinal losers; without playoffs, the
  top 3 of the standings once every game is final).
- If the connection drops, screens show *Offline: reconnecting…* and catch up by themselves when it's back. If the
  internet is gone for good, carry on in the desktop app.
- Afterwards: *Printable results* (`/display/<slug>/print/`) → **Print** (or save as PDF).

## Content and where it comes from

- `src/content/club.ts`, `real.ts`, `community.ts`: real content taken from deadlydropspickleball.com (Nov 2026):
  about text, how-it-works, favourites, the DOMINATE (June 13–14, 2026) and VICTORY Dink for Pink (Oct 17, 2026)
  tournaments, the three shirts, social links, community news, and photos in `public/images/club/`
  (tournament photography by Clara Barra and Bert Temple). These are the **starting content**; after the first
  publish the admin's saved content wins.
- `src/content/charities.ts`: the charities the tournaments play for: Us4Warriors (DOMINATE, story from the charity)
  and Breast Cancer Angels (VICTORY, written from breastcancerangels.org). Flyers are uploaded in Admin → Charities.
  A charity is linked to tournaments by their web address, so after changing a tournament's web address, tick it
  again under Charities.
- The phone number is left off on purpose: the club masks it on its own site. Add one in Club info if wanted.
- `src/content/sample.ts`: sample members, ratings, ladder and the member app, until a real member system
  exists. The top bar says so. (Tournament results are real: they come from the database.)
- `public/images/stand-in/`: stock photos used only by the sample member spotlight.

## Hosting

Production runs at https://ddptournament.com on the VPS as two containers (Next.js standalone server + PostgreSQL 18)
behind the shared Caddy proxy. Pages render per request from the database, so the build needs no database.

- **Deploy:** every push to `main` that touches `web/` or `deploy/vps/` runs the GitHub Actions workflow
  `deploy-vps` (typecheck + tests, then upload, build on the server, wait for the health check). Watch it under
  GitHub → Actions; *Run workflow* there redeploys by hand. The deploy key can only run `ci-deploy.sh` on the server.
  Fallback from a laptop with `ssh smj` access: `bash deploy/vps/deploy.sh` from the repo root.
- **Roll back the code** (not database migrations), on the server in `/root/deadly-drops`:
  `docker tag deadly-drops-web:previous deadly-drops-web:latest && docker compose up -d web`.
- **Secrets** live in `/root/deadly-drops/.env` (see `deploy/vps/.env.example`). A new owner password: run
  `npm run admin:setup` locally, put the new `ADMIN_PASSWORD_HASH` (single-quoted) in that file, then
  `docker compose up -d web`.
- **Backups:** `deploy/vps/backup.sh` runs nightly at 03:15 (database dump + uploaded images, 14 kept, in
  `/root/deadly-drops/backups/`). Restore steps are at the top of the script. They sit on the same disk: copy them
  off the server now and then.

Environment (`.env.local`, never committed; see `.env.example`): `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
(the owner), `CONTENT_DIR` (uploaded images), `NEXT_PUBLIC_SITE_URL`. Staff logins live in the database.

## Code map

- `src/lib/content-schema.ts`: content model and validation rules
- `src/db/`: PostgreSQL schema, connection pool, migrations runner (`drizzle/` holds the SQL)
- `src/lib/store/`: draft/published content store (PostgreSQL) and image files
- `src/lib/data.ts`: the only way pages read content
- `src/components/admin/kit.tsx`: admin form kit (fields, list editor, image picker, uploader)
- `src/lib/auth/`: staff logins, sessions, per-area permissions, login throttling
- `src/lib/tournaments/`: tournament and division model (`schema.ts`), storage (`repo.ts`), multi-day dates
- `src/lib/match/`: the Pickle Match engine, pure and tested: round-robin schedule, game rule, standings and
  tiebreakers, playoff brackets (`bracket.ts`), and how results are presented (`present.ts`)
- `src/lib/play/repo.ts`: teams, schedule, scores, playoffs and check-in in the database; every change bumps the
  tournament's `live_version` and notifies `ddp_live`
- `src/lib/live/` + `src/app/live/[tournamentId]/`: the live feed (PostgreSQL LISTEN → server-sent events) that
  refreshes every open screen
- `src/components/results/Results.tsx`: standings, matches, bracket and medals, shared by the tournament page,
  venue screen and print
- `src/lib/appsync/` + `src/app/api/tournaments/`: the desktop app's download API (bearer key)
- `src/theme/tokens.ts`: default colours and the bundled logo (`themeLogo`); the saved theme from the admin overrides them
