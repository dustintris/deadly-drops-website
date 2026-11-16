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
| Home | `/` |
| Tournaments (season, format, divisions, bracket, registration) | `/tournaments` |
| Community: news, articles, photo stories, community photos | `/community`, `/community/[slug]` |
| About us | `/about` |
| Shop, product, cart | `/shop`, `/shop/[slug]`, `/cart` |
| Gallery with lightbox | `/gallery` |
| Contact | `/contact` |
| Members directory and player profile (sample data) | `/members`, `/members/[slug]` |
| Log in / sign up (preview), member app (sample) | `/login`, `/signup`, `/me` |

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
| Tournaments | name, date (countdown when set), location, fees, prizes, what's included, registration open + link, poster, featured |
| Announcements | the top bar and the homepage ticker |
| Shop & prices | products, prices, stock (sold out / only N left), options, up to 6 photos each, visibility |
| Photos | upload (resized in the browser, JPEG/PNG/WebP, 5 MB max), descriptions, see where each photo is used, delete unused |
| Community & news | news, articles, photo stories with a simple formatting language, cover + photo sets, draft/published, featured |
| Gallery | photos, captions, albums (Community/Socials photos also appear on the Community page) |
| Page text | headline, intro and main photo for Home, About, Community, Shop, Gallery, Contact |
| Club info | contact details, about text and points, how-it-works steps, favourites, social links, member discount |
| FAQ | questions on the Contact page |
| Colours | brand colours with presets; saving is blocked if any text would be hard to read (WCAG 4.5:1) |

Security: scrypt password hashes, HttpOnly SameSite=Strict session cookie (8 h) holding a random token whose SHA-256
is stored in `sessions` (sign out = delete the row), login throttling, every page, server action and route checks the
session and the person's access for that area, same-origin check and an hourly limit on uploads, server-side validation (zod) of every save,
uploads checked by file content with random names and served with `nosniff`, admin pages not indexed or framed,
audit log in the database (`audit_log`).

## Content and where it comes from

- `src/content/club.ts`, `real.ts`, `community.ts`: real content taken from deadlydropspickleball.com (Nov 2026):
  about text, how-it-works, favourites, the DOMINATE (June 13–14, 2026) and VICTORY Dink for Pink (Oct 17, 2026)
  tournaments, the three shirts, social links, community news, and photos in `public/images/club/`
  (tournament photography by Clara Barra and Bert Temple). These are the **starting content**; after the first
  publish the admin's saved content wins.
- The phone number is left off on purpose: the club masks it on its own site. Add one in Club info if wanted.
- `src/content/sample.ts`: sample members, ratings, ladder, bracket and the member app, until a real member and
  results system exists. The top bar says so.
- `public/images/stand-in/`: stock photos used only by the sample member spotlight.

## Hosting

Production runs at https://ddptournament.com on the VPS as two containers (Next.js standalone server + PostgreSQL 18)
behind the shared Caddy proxy. Deploy from the repo root with `bash deploy/vps/deploy.sh` (runs the tests, uploads,
builds on the server, waits for the health check). Server secrets live in `/root/deadly-drops/.env` (see
`deploy/vps/.env.example`); `deploy/vps/backup.sh` runs nightly at 03:15 (database dump + uploaded images, 14 kept,
restore steps in the script). Pages render per request from the database, so the build needs no database.

Environment (`.env.local`, never committed; see `.env.example`): `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`
(the owner), `CONTENT_DIR` (uploaded images), `NEXT_PUBLIC_SITE_URL`. Staff logins live in the database.

## Code map

- `src/lib/content-schema.ts`: content model and validation rules
- `src/db/`: PostgreSQL schema, connection pool, migrations runner (`drizzle/` holds the SQL)
- `src/lib/store/`: draft/published content store (PostgreSQL) and image files
- `src/lib/data.ts`: the only way pages read content
- `src/components/admin/kit.tsx`: admin form kit (fields, list editor, image picker, uploader)
- `src/theme/tokens.ts`: default colours; the saved theme from the admin overrides them
