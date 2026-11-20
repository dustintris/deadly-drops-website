import { EditGate } from '@/components/admin/kit'
import { readDraft } from '@/lib/store/content-store'
import { AnnouncementsEditor } from './AnnouncementsEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Announcements</h1>
          <p className="adm-muted">The bar at the very top of every page, and the scrolling ticker in the accent colour on the homepage.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <AnnouncementsEditor settings={d.settings} ticker={d.ticker} rev={d.rev} />
      </EditGate>
    </>
  )
}
