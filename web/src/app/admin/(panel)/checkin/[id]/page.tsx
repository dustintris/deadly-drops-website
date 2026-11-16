import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { clubToday } from '@/lib/events'
import type { RosterDivision } from '@/lib/play/checkin'
import { getTournamentPlay } from '@/lib/play/repo'
import { dayLabel } from '@/lib/tournaments/days'
import { CheckinDesk } from './CheckinDesk'

export const metadata = { title: 'Check-in' }
export const dynamic = 'force-dynamic'

export default async function CheckinTournament({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission('checkin', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { id: raw } = await params
  const id = /^\d{1,9}$/.test(raw ?? '') ? Number(raw) : 0
  if (id <= 0) notFound()
  const play = await getTournamentPlay(id)
  if (!play) notFound()
  const canEdit = can(s, 'checkin', 'edit')

  // only what the desk shows goes to the browser (no ratings, no who-checked-in)
  const divisions: RosterDivision[] = play.divisions.map((d) => ({
    id: d.id,
    name: d.name,
    dayIndex: d.dayIndex,
    teams: d.teams.map((t) => ({ id: t.id, name: t.name, players: t.players.map((p) => ({ id: p.id, name: p.name, checkedInAt: p.checkedInAt })) })),
  }))

  return (
    <>
      <div className="adm-head">
        <div style={{ display: 'grid', gap: 8 }}>
          <p><Link href="/admin/checkin/">← All tournaments</Link></p>
          <h1>{play.name}: check-in</h1>
          <p className="adm-muted">
            {canEdit ? 'Tap a name as the player arrives. Tap again to undo.' : 'You can see who has arrived but not check players in.'}
          </p>
        </div>
        <div className="adm-actions">
          <Link className="adm-btn" href={`/display/${play.slug}/`} target="_blank" rel="noopener">Venue screen ↗</Link>
          <Link className="adm-btn" href={`/display/${play.slug}/print/`} target="_blank" rel="noopener">Print results ↗</Link>
        </div>
      </div>
      <LiveRefresh tournamentId={play.id} version={play.liveVersion} />
      <CheckinDesk
        tournamentId={play.id}
        days={play.days.map(dayLabel)}
        todayIndex={play.days.indexOf(clubToday())}
        divisions={divisions}
        canEdit={canEdit}
      />
    </>
  )
}
