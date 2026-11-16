import { EditGate } from '@/components/admin/kit'
import { readDraft } from '@/lib/store/content-store'
import { SettingsEditor } from './SettingsEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Club info' }

export default async function SettingsAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Club info</h1>
          <p className="adm-muted">Contact details, the about text and the shop discount. Used across the whole site.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <SettingsEditor initial={d.settings} />
      </EditGate>
    </>
  )
}
