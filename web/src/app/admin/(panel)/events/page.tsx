import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { EventsEditor } from './EventsEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Tournaments' }

export default async function EventsAdmin() {
  const s = await requirePermission('tournaments', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Tournaments</h1>
          <p className="adm-muted">The featured tournament leads the homepage and the Tournaments page.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'tournaments', 'edit')}>
        <EventsEditor initial={draft.events} rev={draft.rev} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
