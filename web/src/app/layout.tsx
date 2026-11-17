import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { MOTION_COOKIE, MOTION_OFF } from '@/lib/motion-pref'
import type { ThemeT } from '@/lib/content-schema'
import { getClub, getTheme } from '@/lib/data'
import { asset } from '@/lib/utils'
import { body, display, mono } from '@/theme/fonts'
import { DEFAULT_LOGO, defaultTheme, themeLogo, themeToCss } from '@/theme/tokens'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com'

// Every page (public, admin, not-found) reads the club info and theme from PostgreSQL, so render per
// request: a publish shows at once, and the Docker build (no database) never bakes stale content into the image.
export const dynamic = 'force-dynamic'

/**
 * The theme for <head> (tab icon, link preview, browser bar colour). `next build` has no database
 * (the same rule as src/instrumentation.ts), so there it is the defaults; per request it is the
 * saved theme, the draft one while previewing, as for the colours below.
 */
async function headTheme(): Promise<ThemeT> {
  if (process.env.NEXT_PHASE === 'phase-production-build' || !process.env.DATABASE_URL) return { ...defaultTheme }
  // the tab icon and bar colour must never be the reason a page (or the error page) fails
  return getTheme().catch(() => ({ ...defaultTheme }))
}

export async function generateMetadata(): Promise<Metadata> {
  const logo = themeLogo(await headTheme())
  // the bundled badge's size is known; an upload's isn't, and the size is only a hint for link previews
  const size = logo.src === DEFAULT_LOGO.src ? { width: 640, height: 640 } : {}
  return {
    title: { default: 'Deadly Drops Pickleball | Chula Vista, CA', template: '%s | Deadly Drops Pickleball' },
    description:
      'Deadly Drops Pickleball: charity tournaments, social play and a welcoming community for players of every level in Chula Vista, CA.',
    icons: { icon: asset(logo.src) },
    metadataBase: new URL(SITE_URL),
    openGraph: {
      title: 'Deadly Drops Pickleball',
      description: "Everybody's welcome. Nobody coasts. Tournaments and community events in Chula Vista, CA.",
      type: 'website',
      images: [{ url: asset(logo.src), ...size, alt: 'Deadly Drops Pickleball logo' }],
    },
    twitter: { card: 'summary', title: 'Deadly Drops Pickleball', description: 'Tournaments and community events in Chula Vista, CA.' },
  }
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await headTheme()).bg, width: 'device-width', initialScale: 1, viewportFit: 'cover' }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // colours, logo and club facts come from the MIS (Admin → Logo & colours, Club info)
  const [club, theme, jar] = await Promise.all([getClub(), getTheme(), cookies()])
  // the visitor paused the site's animations (footer switch): rendered in, so nothing moves even for a moment
  const motionOff = jar.get(MOTION_COOKIE)?.value === MOTION_OFF
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} data-motion={motionOff ? MOTION_OFF : undefined}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsOrganization',
              name: club.name,
              sport: 'Pickleball',
              slogan: club.tagline,
              email: club.email,
              ...(club.phoneHref ? { telephone: club.phoneHref.replace('tel:', '') } : {}),
              sameAs: Object.values(club.social ?? {}).filter(Boolean),
              address: { '@type': 'PostalAddress', addressLocality: 'Chula Vista', addressRegion: 'CA', postalCode: club.postcode, addressCountry: 'US' },
              url: SITE_URL,
              logo: `${SITE_URL}${asset(themeLogo(theme).src)}`,
            }).replace(/</g, '\\u003c'),
          }}
        />
        {children}
      </body>
    </html>
  )
}
