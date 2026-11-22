import Link from 'next/link'
import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { ensureImported, listTournaments } from '@/lib/tournaments/repo'
import type { TournamentOption } from '../charities/CharityEditor'
import { SponsorsEditor } from './SponsorsEditor'

export const metadata = { title: 'Sponsors' }

export default async function SponsorsAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const [{ draft, library }, tournaments] = await Promise.all([getAdminData(), ensureImported().then(() => listTournaments())])
  // only what the picker needs: name and date, including hidden tournaments so a sponsor can be set up before one goes live
  const options: TournamentOption[] = tournaments.map((t) => ({ slug: t.slug, name: t.name, dateLabel: t.info.dateLabel, visible: t.visible }))
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Sponsors</h1>
          <p className="adm-muted">
            The businesses and people who back your tournaments. The Sponsors page shows them grouped by level, Title first,
            and the page of every tournament ticked below shows their logo in a &ldquo;Sponsored by&rdquo; row.
          </p>
        </div>
        <Link href="/sponsors/" className="adm-btn" target="_blank" rel="noopener noreferrer">View the Sponsors page<span className="sr"> (opens in a new tab)</span></Link>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <SponsorsEditor initial={draft.sponsors} rev={draft.rev} tournaments={options} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
