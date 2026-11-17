import { asset } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { getTournamentPlay } from '@/lib/play/repo'
import { dayLabel } from '@/lib/tournaments/days'
import { getTournament } from '@/lib/tournaments/repo'
import { FORMAT_LABELS } from '@/lib/tournaments/schema'
import { LeaveLink } from '../TournamentEditor'
import { PlayManager, type PlayDivision } from './PlayManager'

export const metadata = { title: 'Teams & schedule' }
export const dynamic = 'force-dynamic'

export default async function TournamentPlayAdmin({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission('tournaments', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { id: raw } = await params
  const id = /^\d{1,9}$/.test(raw ?? '') ? Number(raw) : 0
  if (id <= 0) notFound()
  // play has the teams, matches and effective rules; the tournament has each division's courts and timing
  const [play, tournament] = await Promise.all([getTournamentPlay(id), getTournament(id)])
  if (!play || !tournament) notFound()
  const canEdit = can(s, 'tournaments', 'edit')
  const canScore = can(s, 'scoring', 'view')
  const canCheckin = can(s, 'checkin', 'view')

  const setup = new Map(tournament.divisions.map((d) => [d.id, d]))
  const divisions: PlayDivision[] = play.divisions.map((d) => {
    const x = setup.get(d.id)
    const day = play.days[d.dayIndex]
    return {
      id: d.id,
      name: d.name,
      formatLabel: FORMAT_LABELS[d.format],
      dayLabel: day ? dayLabel(day) : null,
      startTime: d.startTime,
      gamesTo: d.gamesTo,
      gamesPerTeam: d.gamesPerTeam,
      winBy2: d.winBy2,
      minutesPerRound: x?.minutesPerRound ?? 20,
      firstCourt: x?.firstCourt ?? 1,
      courtCount: x?.courtCount ?? 1,
      teamLimit: x?.teamLimit ?? null,
      playoffs: d.playoffs,
      bronze: d.bronze,
      playoffGamesTo: play.rules.playoffGamesTo,
      teams: d.teams.map((t) => ({ id: t.id, name: t.name, players: t.players.map((p) => ({ id: p.id, name: p.name, dupr: p.dupr })) })),
      matches: d.matches,
    }
  })

  return (
    <>
      <div className="adm-head">
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
            <LeaveLink href={`/admin/tournaments/${play.id}/`}>← Tournament details</LeaveLink>
            {canScore && <LeaveLink href={`/admin/score/${play.id}/`}>Scoring →</LeaveLink>}
            {canCheckin && <LeaveLink href={`/admin/checkin/${play.id}/`}>Check-in →</LeaveLink>}
            <a href={asset(`/display/${play.slug}/`)} target="_blank" rel="noopener">Venue screen ↗</a>
            <a href={asset(`/display/${play.slug}/print/`)} target="_blank" rel="noopener">Printable results ↗</a>
          </p>
          <h1>{play.name}: teams &amp; schedule</h1>
          <p className="adm-muted">
            {canEdit
              ? 'Enter or paste each division’s teams, save them, then make the schedule. Changes show on the website and venue screens straight away.'
              : 'You can view the teams and schedule but not change them.'}
          </p>
        </div>
      </div>
      <LiveRefresh tournamentId={play.id} version={play.liveVersion} />
      {divisions.length === 0 ? (
        <p className="adm-card">
          This tournament has no divisions yet.{' '}
          {canEdit ? <Link href={`/admin/tournaments/${play.id}/`}>Add them in the tournament details</Link> : null}
        </p>
      ) : (
        <PlayManager divisions={divisions} canEdit={canEdit} />
      )}
    </>
  )
}
