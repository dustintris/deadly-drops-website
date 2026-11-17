import { cookies } from 'next/headers'
import { CartProvider } from '@/components/CartContext'
import { MobileTabBar } from '@/components/MobileTabBar'
import { Motion } from '@/components/Motion'
import { PreviewBar } from '@/components/PreviewBar'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import shell from '@/components/shell.module.css'
import { isPreview } from '@/lib/content'
import { MOTION_COOKIE, MOTION_OFF } from '@/lib/motion-pref'
import { getClub, getClubLogo, getNotice } from '@/lib/data'

/** Public site shell: notice bar, header, footer and the phone tab bar. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [club, logo, notice, preview, jar] = await Promise.all([getClub(), getClubLogo(), getNotice(), isPreview(), cookies()])
  const motionPaused = jar.get(MOTION_COOKIE)?.value === MOTION_OFF
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <CartProvider>
        {preview && <PreviewBar />}
        {notice && (
          <p className={shell.notice}>
            {notice.href ? <a href={notice.href}>{notice.text}</a> : notice.text}
          </p>
        )}
        <SiteHeader city={club.city} logo={logo.src} />
        <main id="main">{children}</main>
        <SiteFooter club={club} logo={logo} motionPaused={motionPaused} />
        <MobileTabBar />
        <Motion />
      </CartProvider>
    </>
  )
}
