import { readDraft } from '@/lib/store/file-store'
import { FaqEditor } from './FaqEditor'

export const metadata = { title: 'FAQ' }

export default async function FaqAdmin() {
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>FAQ</h1>
          <p className="adm-muted">Questions shown on the Contact page under &ldquo;Before you write&rdquo;.</p>
        </div>
      </div>
      <FaqEditor initial={d.faqs} />
    </>
  )
}
