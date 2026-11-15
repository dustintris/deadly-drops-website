import { MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { EventsEditor } from './EventsEditor'

export const metadata = { title: 'Tournaments' }

export default async function EventsAdmin() {
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Tournaments</h1>
          <p className="adm-muted">The featured tournament leads the homepage and the Tournaments page.</p>
        </div>
      </div>
      <EventsEditor initial={draft.events} rev={draft.rev} />
    </MediaLibraryProvider>
  )
}
