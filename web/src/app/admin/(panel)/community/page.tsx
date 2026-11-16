import Link from 'next/link'
import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { CommunityEditor } from './CommunityEditor'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'

export const metadata = { title: 'Community & news' }

export default async function CommunityAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { draft, library } = await getAdminData()
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Community &amp; news</h1>
          <p className="adm-muted">News, articles and photo stories for the Community page. Only posts set to Published appear on the site, newest first.</p>
          <p className="adm-muted" style={{ marginTop: 6 }}>
            Community page headline and intro are under <Link href="/admin/pages/" style={{ fontWeight: 600, textDecoration: 'underline' }}>Page text</Link>.
          </p>
        </div>
        <Link href="/community/" className="adm-btn" target="_blank" rel="noopener noreferrer">View the Community page<span className="sr"> (opens in a new tab)</span></Link>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <CommunityEditor initial={draft.posts ?? []} rev={draft.rev} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
