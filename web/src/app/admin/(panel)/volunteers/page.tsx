import Link from 'next/link'
import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { VolunteersEditor } from './VolunteersEditor'

export const metadata = { title: 'Volunteers' }

export default async function VolunteersAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Volunteers</h1>
          <p className="adm-muted">
            The people on your volunteer crew, the jobs on the Volunteers page, what volunteers get, and the sign-up form. Sign-ups arrive in
            the <Link href="/admin/inbox/" style={{ fontWeight: 600, textDecoration: 'underline' }}>Inbox</Link> under
            &ldquo;Volunteering&rdquo;. The headline, intro and photo are under <Link href="/admin/pages/" style={{ fontWeight: 600, textDecoration: 'underline' }}>Page text</Link>.
          </p>
        </div>
        <Link href="/volunteers/" className="adm-btn" target="_blank" rel="noopener noreferrer">View the Volunteers page<span className="sr"> (opens in a new tab)</span></Link>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <VolunteersEditor initial={draft.volunteers} rev={draft.rev} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
