# Deadly Drops Pickleball: website + owner admin (MIS)

Next.js 16 / React 19 / TypeScript. Public site in `src/app/(site)`, owner admin in `src/app/admin`.

```
cd web
npm install
npm run admin:setup   # once: creates .env.local with the owner email, password hash and session secret
npm run dev           # http://localhost:3000, admin at http://localhost:3000/admin/
npm run build && npm start
```

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
(no rebuild), **Discard** goes back to what is live. The last 20 published versions are kept in `data/content/history/`.

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

Security: scrypt password hash, signed HttpOnly SameSite=Strict session cookie (8 h), login throttling, every
server action and route checks the session, same-origin check on uploads, server-side validation (zod) of every save,
uploads checked by file content with random names and served with `nosniff`, admin pages not indexed or framed,
audit log in `data/audit.log`.

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

The admin saves to disk, so the site runs as a Node server (`npm start`), not a static export:

- **Node host with a persistent disk** (Fly.io, Render, a VPS, Docker): set `CONTENT_DIR` to the disk and back it up.
- **Vercel / serverless**: the file system is not persistent. Add a database + blob storage adapter with the same
  functions as `src/lib/store/file-store.ts` and `media-store.ts` before going live there.

Environment (`.env.local`, never committed; see `.env.example`): `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`,
optional `ADMIN_SESSION_VERSION` (raise it to sign everyone out), `CONTENT_DIR`, `NEXT_PUBLIC_SITE_URL`.

## Code map

- `src/lib/content-schema.ts`: content model and validation rules
- `src/lib/store/`: draft/published JSON store and image files
- `src/lib/data.ts`: the only way pages read content
- `src/components/admin/kit.tsx`: admin form kit (fields, list editor, image picker, uploader)
- `src/theme/tokens.ts`: default colours; the saved theme from the admin overrides them
