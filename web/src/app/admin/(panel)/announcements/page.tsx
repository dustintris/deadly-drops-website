import { readDraft } from '@/lib/store/content-store'
import { AnnouncementsEditor } from './AnnouncementsEditor'
import { requireAdmin } from '@/lib/auth/session'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsAdmin() {
  await requireAdmin() // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Announcements</h1>
          <p className="adm-muted">The bar at the very top of every page, and the scrolling lime ticker on the homepage.</p>
        </div>
      </div>
      <AnnouncementsEditor settings={d.settings} ticker={d.ticker} rev={d.rev} />
    </>
  )
}
