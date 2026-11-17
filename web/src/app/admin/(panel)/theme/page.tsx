import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { ThemeEditor } from './ThemeEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Logo & colours' }

export default async function ThemeAdmin() {
  const s = await requirePermission('branding', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Logo &amp; colours</h1>
          <p className="adm-muted">Change the club logo and the site colours. Every text colour is checked against its background so the site stays readable.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'branding', 'edit')}>
        <ThemeEditor initial={draft.theme} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
