import { readDraft } from '@/lib/store/file-store'
import { ThemeEditor } from './ThemeEditor'
import { requireAdmin } from '@/lib/auth/session'

export const metadata = { title: 'Colours' }

export default async function ThemeAdmin() {
  await requireAdmin() // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Colours</h1>
          <p className="adm-muted">Change the site colours. Every text colour is checked against its background so the site stays readable.</p>
        </div>
      </div>
      <ThemeEditor initial={d.theme} />
    </>
  )
}
