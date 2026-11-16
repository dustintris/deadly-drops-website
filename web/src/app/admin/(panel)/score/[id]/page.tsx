import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { clubToday } from '@/lib/events'
import { getTournamentPlay } from '@/lib/play/repo'
import { dayLabel } from '@/lib/tournaments/days'
import { ScoreBoard, type BoardDivision } from './ScoreBoard'

export const metadata = { title: 'Scoring' }
export const dynamic = 'force-dynamic'

export default async function ScoreTournament({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePermission('scoring', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const { id: raw } = await params
  const id = /^\d{1,9}$/.test(raw ?? '') ? Number(raw) : 0
  if (id <= 0) notFound()
  const play = await getTournamentPlay(id)
  if (!play) notFound()
  const canEdit = can(s, 'scoring', 'edit')

  // only what the board shows goes to the browser
  const divisions: BoardDivision[] = play.divisions.map((d) => ({
    id: d.id,
    name: d.name,
    dayIndex: d.dayIndex,
    gamesTo: d.gamesTo,
    teams: d.teams.map((t) => ({ id: t.id, name: t.name, players: t.players.map((p) => p.name) })),
    matches: d.matches,
  }))

  return (
    <>
      <div className="adm-head">
        <div style={{ display: 'grid', gap: 8 }}>
          <p><Link href="/admin/score/">← All tournaments</Link></p>
          <h1>{play.name}</h1>
          <p className="adm-muted">
            {canEdit ? 'Tap a match to enter its score. Other scorekeepers’ saves appear here by themselves.' : 'You can see the scores but not enter them.'}
          </p>
        </div>
      </div>
      <LiveRefresh tournamentId={play.id} version={play.liveVersion} />
      <ScoreBoard
        tournamentId={play.id}
        days={play.days.map(dayLabel)}
        todayIndex={play.days.indexOf(clubToday())}
        playoffGamesTo={play.rules.playoffGamesTo}
        winBy2={play.rules.winBy2}
        divisions={divisions}
        canEdit={canEdit}
      />
    </>
  )
}
