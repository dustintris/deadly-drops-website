/**
 * One division's results: status, standings and matches (or its teams before there's a schedule).
 * Server components shared by the public tournament page, the projector board and printable results.
 *
 * variant:
 *  - page:  everything, for reading on a phone or laptop
 *  - board: standings plus only the round being played, sized for a projector across the room
 *  - print: everything, without the scroll box and focus stops a sheet of paper can't use
 */
import l from '@/components/live.module.css'
import { divisionStatus, matchGroups, playerLine, plural, signed } from '@/lib/match/present'
import { formatTime12 } from '@/lib/match/schedule'
import type { Tiebreaker } from '@/lib/match/types'
import type { DivisionPlay, Match } from '@/lib/play/repo'
import { FORMAT_LABELS } from '@/lib/tournaments/schema'

export type ResultsVariant = 'page' | 'board' | 'print'

export function MatchCard({ m, names, day }: { m: Match; names: Map<number, string>; day?: string }) {
  const a = m.scoreA ?? 0
  const b = m.scoreB ?? 0
  const final = m.status === 'final'
  const sides = [
    { key: 'a', id: m.teamAId, score: a, won: final && a > b },
    { key: 'b', id: m.teamBId, score: b, won: final && b > a },
  ]
  return (
    <li className={l.match} data-status={m.status}>
      <p className={l.matchMeta}>
        {m.startsAt && <time dateTime={day ? `${day}T${m.startsAt}` : m.startsAt}>{formatTime12(m.startsAt)}</time>}
        {m.court !== null && <span>Court {m.court}</span>}
        {m.status !== 'scheduled' && (
          <span className={l.badge} data-status={m.status}>
            {m.status === 'live' && <span className="live-dot" aria-hidden="true" />}
            {m.status === 'live' ? 'Live' : 'Final'}
          </span>
        )}
      </p>
      {sides.map((s) => {
        const name = s.id !== null ? names.get(s.id) : undefined
        return (
          <p key={s.key} className={l.side} data-win={s.won}>
            <span className={name ? undefined : l.tbd}>{name ?? 'To be decided'}</span>
            {m.status !== 'scheduled' && (
              <strong>
                <span className="sr">: </span>
                {s.score}
                {s.won && <span className="sr"> (won)</span>}
              </strong>
            )}
          </p>
        )
      })}
    </li>
  )
}

/** The groups a variant shows: all of them, or on the board only the first one still being played (else the last). */
function shownGroups(matches: Match[], variant: ResultsVariant) {
  const groups = matchGroups(matches)
  if (variant !== 'board') return groups
  const current = groups.find((g) => g.matches.some((m) => m.status !== 'final')) ?? groups[groups.length - 1]
  return current ? [current] : []
}

export function DivisionResults({
  d, tiebreakers, day, level, variant = 'page',
}: { d: DivisionPlay; tiebreakers: Tiebreaker[]; day?: string; level: 2 | 3 | 4; variant?: ResultsVariant }) {
  const H = (`h${level}` as 'h2' | 'h3' | 'h4')
  const Sub = (`h${level + 1}` as 'h3' | 'h4' | 'h5')
  const id = `results-${d.id}`
  const { board, state, status, ranked } = divisionStatus(d, tiebreakers)
  const names = new Map(d.teams.map((t) => [t.id, t.name]))
  const players = new Map(d.teams.map((t) => [t.id, playerLine(t.players.map((p) => p.name))]))
  const scrollBox = variant === 'page'

  return (
    <article className={`card ${l.division}`} data-state={state} data-variant={variant} aria-labelledby={id}>
      <header className={l.divHead}>
        <H id={id} className={l.divName}>{d.name}</H>
        <p className={l.status} data-state={state}>
          {state === 'live' && <span className="live-dot" aria-hidden="true" />}
          {status}
        </p>
        <p className={l.divMeta}>
          {FORMAT_LABELS[d.format]} · {plural(d.teams.length, 'team')} · Games to {d.gamesTo}{d.winBy2 ? ', win by 2' : ''}
        </p>
      </header>

      {d.matches.length > 0 ? (
        <div className={l.body}>
          <div className={l.tableWrap} {...(scrollBox ? { role: 'region', 'aria-labelledby': `${id}-standings`, tabIndex: 0 } : {})}>
            <table className={l.table}>
              <caption id={`${id}-standings`}>Standings<span className="sr">, {d.name}</span></caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Team</th>
                  <th scope="col" className={l.num}><span aria-hidden="true">W–L</span><span className="sr">Wins and losses</span></th>
                  <th scope="col" className={l.num}><span aria-hidden="true">+/−</span><span className="sr">Point difference</span></th>
                </tr>
              </thead>
              <tbody>
                {board.standings.map((s) => {
                  const who = players.get(s.teamId)
                  return (
                    <tr key={s.teamId} data-top={ranked && s.rank === 1}>
                      <td className={l.rank}>{ranked ? s.rank : <><span aria-hidden="true">–</span><span className="sr">Not ranked yet</span></>}</td>
                      <th scope="row">
                        {s.name}
                        {who && who !== s.name && <span className={l.players}>{who}</span>}
                      </th>
                      <td className={l.num}>
                        <span aria-hidden="true">{s.wins}–{s.losses}</span>
                        <span className="sr">{plural(s.wins, 'win')}, {s.losses} {s.losses === 1 ? 'loss' : 'losses'}</span>
                      </td>
                      <td className={l.num}>{signed(s.pointDiff)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={l.rounds}>
            {shownGroups(d.matches, variant).map((g) => (
              <div key={g.key} className={l.round}>
                <Sub id={`${id}-${g.key}`} className={l.roundName}>{g.label}</Sub>
                <ol className={l.matches} aria-labelledby={`${id}-${g.key}`}>
                  {g.matches.map((m) => <MatchCard key={m.id} m={m} names={names} day={day} />)}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ) : d.teams.length > 0 ? (
        <ul className={l.teams} aria-label={`${d.name} teams`}>
          {d.teams.map((team) => {
            const who = players.get(team.id)
            return (
              <li key={team.id}>
                <strong>{team.name}</strong>
                {who && who !== team.name && <span>{who}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={l.empty}>Teams will be announced.</p>
      )}
    </article>
  )
}
