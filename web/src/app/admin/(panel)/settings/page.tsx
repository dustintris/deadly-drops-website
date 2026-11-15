import { readDraft } from '@/lib/store/file-store'
import { SettingsEditor } from './SettingsEditor'
import { requireAdmin } from '@/lib/auth/session'

export const metadata = { title: 'Club info' }

export default async function SettingsAdmin() {
  await requireAdmin() // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Club info</h1>
          <p className="adm-muted">Contact details, the about text and the shop discount. Used across the whole site.</p>
        </div>
      </div>
      <SettingsEditor initial={d.settings} />
    </>
  )
}
