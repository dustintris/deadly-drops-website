import { readDraft } from '@/lib/store/file-store'
import { ThemeEditor } from './ThemeEditor'

export const metadata = { title: 'Colours' }

export default async function ThemeAdmin() {
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
