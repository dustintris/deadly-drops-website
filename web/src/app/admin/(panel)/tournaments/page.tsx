import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { ensureImported, listTournaments } from '@/lib/tournaments/repo'
import { TournamentList, type TournamentRow } from './TournamentList'

export const metadata = { title: 'Tournaments' }
export const dynamic = 'force-dynamic'

export default async function TournamentsAdmin() {
  const s = await requirePermission('tournaments', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  await ensureImported() // the tournaments that lived in the website content come over once
  const canEdit = can(s, 'tournaments', 'edit')
  // only what the list shows goes to the browser
  const rows: TournamentRow[] = (await listTournaments()).map((t) => ({
    id: t.id,
    name: t.name,
    dateLabel: t.info.dateLabel,
    visible: t.visible,
    featured: t.featured,
    divisionCount: t.divisions.length,
  }))
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Tournaments</h1>
          <p className="adm-muted">
            {canEdit
              ? 'Saved changes show on the website straight away. A hidden tournament is your draft. The featured one leads the home page.'
              : 'Every tournament, shown or hidden. You can look but not change anything here.'}
          </p>
        </div>
      </div>
      <TournamentList tournaments={rows} canEdit={canEdit} />
    </>
  )
}
