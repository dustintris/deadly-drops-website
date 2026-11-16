import { EditGate } from '@/components/admin/kit'
import { readDraft } from '@/lib/store/content-store'
import { ThemeEditor } from './ThemeEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Colours' }

export default async function ThemeAdmin() {
  const s = await requirePermission('branding', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Colours</h1>
          <p className="adm-muted">Change the site colours. Every text colour is checked against its background so the site stays readable.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'branding', 'edit')}>
        <ThemeEditor initial={d.theme} />
      </EditGate>
    </>
  )
}
