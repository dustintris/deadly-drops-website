import Link from 'next/link'
import { EditGate } from '@/components/admin/kit'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { readDraft } from '@/lib/store/content-store'
import { VolunteersEditor } from './VolunteersEditor'

export const metadata = { title: 'Volunteers' }

export default async function VolunteersAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const d = await readDraft()
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Volunteers</h1>
          <p className="adm-muted">
            The jobs on the Volunteers page, what volunteers get, and the sign-up form. Sign-ups arrive in
            the <Link href="/admin/inbox/" style={{ fontWeight: 600, textDecoration: 'underline' }}>Inbox</Link> under
            &ldquo;Volunteering&rdquo;. The headline, intro and photo are under <Link href="/admin/pages/" style={{ fontWeight: 600, textDecoration: 'underline' }}>Page text</Link>.
          </p>
        </div>
        <Link href="/volunteers/" className="adm-btn" target="_blank" rel="noopener noreferrer">View the Volunteers page<span className="sr"> (opens in a new tab)</span></Link>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <VolunteersEditor initial={d.volunteers} />
      </EditGate>
    </>
  )
}
