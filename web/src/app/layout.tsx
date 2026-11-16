import type { Metadata, Viewport } from 'next'
import { getClub, getTheme } from '@/lib/data'
import { body, display, mono } from '@/theme/fonts'
import { defaultTheme, themeToCss } from '@/theme/tokens'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Deadly Drops Pickleball | Chula Vista, CA', template: '%s | Deadly Drops Pickleball' },
  description:
    'Deadly Drops Pickleball: charity tournaments, social play and a welcoming community for players of every level in Chula Vista, CA.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png` },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com'),
  openGraph: {
    title: 'Deadly Drops Pickleball',
    description: "Everybody's welcome. Nobody coasts. Tournaments and community events in Chula Vista, CA.",
    type: 'website',
    images: [{ url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png`, width: 945, height: 1145, alt: 'Deadly Drops Pickleball crest' }],
  },
  twitter: { card: 'summary', title: 'Deadly Drops Pickleball', description: 'Tournaments and community events in Chula Vista, CA.' },
}

// Every page (public, admin, not-found) reads the club info and theme from PostgreSQL, so render per
// request: a publish shows at once, and the Docker build (no database) never bakes stale content into the image.
export const dynamic = 'force-dynamic'

export const viewport: Viewport = { themeColor: defaultTheme.bg, width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // colours and club facts come from the MIS (Admin → Colours, Club info)
  const [club, theme] = await Promise.all([getClub(), getTheme()])
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
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
              url: process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com',
              logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com'}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png`,
            }).replace(/</g, '\\u003c'),
          }}
        />
        {children}
      </body>
    </html>
  )
}
