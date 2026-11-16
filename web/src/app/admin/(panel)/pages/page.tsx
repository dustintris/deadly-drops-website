import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { PagesEditor } from './PagesEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Page text' }

export default async function PagesAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Page text</h1>
          <p className="adm-muted">The headline, intro and main photo at the top of each page.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <PagesEditor initial={draft.pages} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
