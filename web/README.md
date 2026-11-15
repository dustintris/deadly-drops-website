# Deadly Drops Pickleball: website (Next.js)

Clickable build of the "Deadly Drops UI Mockups" design: all 9 screens, desktop and phone.

```
cd web
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to web/out
```

## Screens

| Screen | Route |
|---|---|
| Homepage | `/` |
| Members directory, player profile/dashboard | `/members`, `/members/[slug]` |
| Tournaments: schedule, format, divisions, bracket, registration | `/tournaments` |
| About us | `/about` |
| Shop: catalogue, product detail, cart | `/shop`, `/shop/[slug]`, `/cart` |
| Gallery with lightbox | `/gallery` |
| Contact | `/contact` |
| Log in / create account | `/login`, `/signup` |
| Member app: tonight, check-in, my play | `/me` |

## What is real and what is sample

- **Real club facts** (`src/content/club.ts`): name, tagline, about text, Chula Vista CA 91915, email, phone,
  Dominate Charity 2026 ($55, $65 with meal, shirt, Gold $100 / Silver $75 / Bronze $50), how it works,
  Courtside Fuel / Elite Gear / Match Play. The event date is not published yet, so it shows "Date to be
  announced"; set `date` to an ISO date and the countdown switches on.
- **Sample content** (`src/content/sample.ts`): members, ratings, ladder, bracket, results, spotlight quotes,
  committee, shop products and prices, gallery captions, the signed-in member. A notice bar on every page says so.
- **Stand-in photos** (`public/images/stand-in`): stock photos from the mockup, no licence info. Replace them
  with club photos before launch. Shop products use drawn illustrations until product photos exist.

## Preparing for production

- **Data**: pages only read from `src/lib/data.ts`. Swap each getter for an API / database call.
- **Theme**: every colour comes from `src/theme/tokens.ts` as CSS variables. The planned admin (MIS) colour
  setting only has to pass a different `Theme` object in `src/app/layout.tsx`.
- **Fonts**: Anton, Barlow, JetBrains Mono, self-hosted from the mockup (OFL, `src/fonts/LICENSES.txt`).
- **Stubs to connect** (each file says where):
  - auth: `AuthForm.tsx`
  - tournament registration and payment: `RegistrationForm.tsx`
  - cart and checkout: `CartContext.tsx`, `CartView.tsx`
  - contact form: `ContactForm.tsx`
  - newsletter: `NewsletterForm.tsx`
  - live score feed: `LiveScore.tsx`
  - check-in: `TonightCard.tsx`
- **Hosting**: static export by default (works on GitHub Pages, set `NEXT_PUBLIC_BASE_PATH` for a sub-path).
  Once API routes or auth are added, set `NEXT_OUTPUT=server` and deploy to a Node host such as Vercel.
