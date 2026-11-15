import { AdminNav } from '@/components/admin/AdminNav'
import { PublishBar } from '@/components/admin/PublishBar'
import { requireAdmin } from '@/lib/auth/session'
import { unpublishedSections } from '@/lib/store/file-store'

export const dynamic = 'force-dynamic'

const LABELS: Record<string, string> = {
  settings: 'club info', theme: 'colours', events: 'tournaments', ticker: 'announcements', products: 'shop',
  media: 'photos', gallery: 'gallery', posts: 'community', faqs: 'FAQ', pages: 'page text',
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  const changed = (await unpublishedSections()).map((k) => LABELS[k] ?? k)
  return (
    <div className="adm-shell">
      <AdminNav email={session.email} />
      <div className="adm-main">
        <PublishBar changed={changed} />
        <main className="adm-page" id="admin-main">{children}</main>
      </div>
    </div>
  )
}
