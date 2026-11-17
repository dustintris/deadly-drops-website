import Link from 'next/link'
import { EditGate, MediaLibraryProvider } from '@/components/admin/kit'
import { getAdminData } from '@/lib/admin-data'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { ensureImported, listTournaments } from '@/lib/tournaments/repo'
import { CharityEditor, type TournamentOption } from './CharityEditor'

export const metadata = { title: 'Charities' }

export default async function CharitiesAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const [{ draft, library }, tournaments] = await Promise.all([getAdminData(), ensureImported().then(() => listTournaments())])
  // only what the picker needs: name and date, including hidden tournaments so a charity can be set up before one goes live
  const options: TournamentOption[] = tournaments.map((t) => ({ slug: t.slug, name: t.name, dateLabel: t.info.dateLabel, visible: t.visible }))
  return (
    <MediaLibraryProvider initial={library}>
      <div className="adm-head">
        <div>
          <h1>Charities</h1>
          <p className="adm-muted">
            The charities your tournaments play for. Each one gets its own section on the Charity page, a card on the home page,
            and a &ldquo;Playing for&rdquo; block on the page of every tournament ticked below.
          </p>
        </div>
        <Link href="/charity/" className="adm-btn" target="_blank" rel="noopener noreferrer">View the Charity page<span className="sr"> (opens in a new tab)</span></Link>
      </div>
      <EditGate canEdit={can(s, 'content', 'edit')}>
        <CharityEditor initial={draft.charities} rev={draft.rev} tournaments={options} />
      </EditGate>
    </MediaLibraryProvider>
  )
}
