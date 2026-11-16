import { EditGate } from '@/components/admin/kit'
import { readDraft } from '@/lib/store/content-store'
import { FaqEditor } from './FaqEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'FAQ' }

export default async function FaqAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>FAQ</h1>
          <p className="adm-muted">Questions shown on the Contact page under &ldquo;Before you write&rdquo;.</p>
        </div>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <FaqEditor initial={d.faqs} />
      </EditGate>
    </>
  )
}
