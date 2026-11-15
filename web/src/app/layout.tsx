import type { Metadata, Viewport } from 'next'
import { CartProvider } from '@/components/CartContext'
import { MobileTabBar } from '@/components/MobileTabBar'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import shell from '@/components/shell.module.css'
import { getClub } from '@/lib/data'
import { body, display, mono } from '@/theme/fonts'
import { defaultTheme, themeToCss } from '@/theme/tokens'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Deadly Drops Pickleball | Chula Vista, CA', template: '%s | Deadly Drops Pickleball' },
  description:
    'Structured pickleball tournaments and community events in Chula Vista, CA. Register for Dominate Charity 2026: $55 entry, cash prizes for the podium.',
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.png` },
  openGraph: { title: 'Deadly Drops Pickleball', description: "Everybody's welcome. Nobody coasts.", type: 'website' },
}

export const viewport: Viewport = { themeColor: defaultTheme.bg, width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const club = await getClub()
  // Future MIS: load the club's saved theme here instead of defaultTheme.
  const theme = defaultTheme
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <CartProvider>
          <p className={shell.notice}>Preview build · member names, ratings, results, shop items and photos are sample content</p>
          <SiteHeader city={club.city} />
          <main id="main">{children}</main>
          <SiteFooter club={club} />
          <MobileTabBar />
        </CartProvider>
      </body>
    </html>
  )
}
