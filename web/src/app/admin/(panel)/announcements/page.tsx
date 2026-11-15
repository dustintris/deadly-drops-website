import { readDraft } from '@/lib/store/file-store'
import { AnnouncementsEditor } from './AnnouncementsEditor'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsAdmin() {
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
