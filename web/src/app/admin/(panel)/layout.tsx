import { AdminNav } from '@/components/admin/AdminNav'
import { PublishBar } from '@/components/admin/PublishBar'
import { can, SECTION_AREA } from '@/lib/auth/permissions'
import { requireAdmin } from '@/lib/auth/session'
import { readPublished, unpublishedSections } from '@/lib/store/content-store'
import { themeLogo } from '@/theme/tokens'

export const dynamic = 'force-dynamic'

const LABELS: Record<string, string> = {
  settings: 'club info', theme: 'logo & colours', ticker: 'announcements', products: 'shop',
  media: 'photos', gallery: 'gallery', posts: 'community', faqs: 'FAQ', charities: 'charities', sponsors: 'sponsors', volunteers: 'volunteers', pages: 'page text',
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  // the menu shows the live club logo (a draft logo shows in Preview site)
  const [unpublished, live] = await Promise.all([unpublishedSections(), readPublished()])
  // Publish and Discard only act on sections this person may edit; the rest are shown as a note
  const mine = (k: (typeof unpublished)[number]) => can(session, SECTION_AREA[k], 'edit')
  const changed = unpublished.filter(mine).map((k) => LABELS[k] ?? k)
  const others = unpublished.filter((k) => !mine(k)).map((k) => LABELS[k] ?? k)
  // only what the menu needs: never hand the session itself (token hash) to a client component
  const who = { name: session.name, email: session.email, isOwner: session.isOwner, perms: session.perms }
  return (
    <div className="adm-shell">
      <AdminNav who={who} logo={themeLogo(live.theme).src} />
      <div className="adm-main">
        <PublishBar changed={changed} others={others} />
        <main className="adm-page" id="admin-main">{children}</main>
      </div>
    </div>
  )
}
