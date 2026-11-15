import { CartProvider } from '@/components/CartContext'
import { MobileTabBar } from '@/components/MobileTabBar'
import { PreviewBar } from '@/components/PreviewBar'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import shell from '@/components/shell.module.css'
import { isPreview } from '@/lib/content'
import { getClub, getNotice } from '@/lib/data'

// re-render public pages at least hourly, so tournament dates (past / upcoming) stay current without a publish
export const revalidate = 3600

/** Public site shell: notice bar, header, footer and the phone tab bar. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [club, notice, preview] = await Promise.all([getClub(), getNotice(), isPreview()])
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
        <SiteHeader city={club.city} />
        <main id="main">{children}</main>
        <SiteFooter club={club} />
        <MobileTabBar />
      </CartProvider>
    </>
  )
}
