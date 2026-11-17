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
import type { CSSProperties } from 'react'
import { bracketPlan, gameKey, gameLabel, gameShort, planOf, sourceLabel, type BracketGame } from '@/lib/match/bracket'
import { divisionStatus, hasBracket, matchGroups, MEDAL_LABELS, medals, playerLine, playoffGames, plural, signed, STAGE_LABELS, type MedalPlace } from '@/lib/match/present'
import { formatTime12 } from '@/lib/match/schedule'
import type { Tiebreaker } from '@/lib/match/types'
import type { DivisionPlay, Match } from '@/lib/play/repo'
import { FORMAT_LABELS } from '@/lib/tournaments/schema'

export type ResultsVariant = 'page' | 'board' | 'print'

const MEDAL_ICON: Record<MedalPlace, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' }

type CardExtras = {
  /** names the game ("Semifinal 1") on a bracket card */
  title?: string
  /** what an empty side waits for ("1st in pool", "Winner QF 2") instead of "To be decided" */
  waiting?: [string, string]
  /** pool finishing place shown before a playoff team's name */
  seedOf?: Map<number, number>
}

export function MatchCard({ m, names, day, title, waiting, seedOf }: { m: Match; names: Map<number, string>; day?: string } & CardExtras) {
  const a = m.scoreA ?? 0
  const b = m.scoreB ?? 0
  const final = m.status === 'final'
  const sides = [
    { key: 'a', id: m.teamAId, score: a, won: final && a > b, waiting: waiting?.[0] },
    { key: 'b', id: m.teamBId, score: b, won: final && b > a, waiting: waiting?.[1] },
  ]
  return (
    <li className={l.match} data-status={m.status}>
      <p className={l.matchMeta}>
        {title && <span className={l.gameTitle}>{title}</span>}
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
        const seed = s.id !== null ? seedOf?.get(s.id) : undefined
        return (
          <p key={s.key} className={l.side} data-win={s.won}>
            {seed !== undefined && <span className={l.seed}><span className="sr">Seed </span>{seed}</span>}
            {name ? <span>{name}</span> : s.waiting ? (
              <span className={l.tbd}><span className="sr">Waiting for </span>{s.waiting}</span>
            ) : (
              <span className={l.tbd}>To be decided</span>
            )}
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

const COLUMN_LABEL = (games: BracketGame[]) =>
  games.some((g) => g.stage === 'final') ? (games.length > 1 ? 'Medal games' : STAGE_LABELS.final) : STAGE_LABELS[games[0].stage]

/** A placeholder for a bracket game that isn't drawn yet (shown before pool play ends). */
const unplayed = (g: BracketGame, divisionId: number): Match => ({
  id: -(g.round * 10 + g.slot), divisionId, stage: g.stage, round: g.round, slot: g.slot, court: null, startsAt: null,
  teamAId: null, teamBId: null, scoreA: null, scoreB: null, status: 'scheduled', version: 0, updatedBy: null, updatedAt: '',
})

/** Each drawn team's seed (its pool finishing place), read from the first-round games it was drawn into. */
function drawnSeeds(stored: Match[]): Map<number, number> {
  const seeds = new Map<number, number>()
  if (!stored.length) return seeds
  for (const g of planOf(stored)) {
    const m = stored.find((x) => x.stage === g.stage && x.slot === g.slot)
    if (!m) continue
    if ('seed' in g.a && m.teamAId !== null) seeds.set(m.teamAId, g.a.seed)
    if ('seed' in g.b && m.teamBId !== null) seeds.set(m.teamBId, g.b.seed)
  }
  return seeds
}

/**
 * The playoff bracket, one column per round (the final and bronze match share the last). Before the
 * draw it shows the shape, each side saying where its team will come from. On the venue board,
 * finished rounds drop off (the last two rounds always stay) so a top-8 bracket fits the screen.
 */
function Bracket({ d, names, id, Sub, day, variant }: {
  d: DivisionPlay; names: Map<number, string>; id: string; Sub: 'h3' | 'h4' | 'h5'; day?: string; variant: ResultsVariant
}) {
  const stored = playoffGames(d)
  const plan = stored.length ? planOf(stored) : hasBracket(d) && d.playoffs !== 'none' ? bracketPlan(d.playoffs, d.bronze) : []
  if (!plan.length) return null
  const byKey = new Map(stored.map((m) => [gameKey(m), m]))
  const seedOf = drawnSeeds(stored)
  let rounds = [...new Set(plan.map((g) => g.round))].map((r) => plan.filter((g) => g.round === r))
  if (variant === 'board') {
    const done = (games: BracketGame[]) => games.every((g) => byKey.get(gameKey(g))?.status === 'final')
    while (rounds.length > 2 && done(rounds[0])) rounds = rounds.slice(1)
  }
  return (
    <section className={l.bracket} aria-labelledby={`${id}-playoffs`}>
      <Sub id={`${id}-playoffs`} className={l.roundName}>Playoffs</Sub>
      {!stored.length && <p className={l.bracketNote}>Drawn from the standings when pool play ends.</p>}
      <div className={l.bracketGrid} style={{ '--rounds': rounds.length } as CSSProperties}>
        {rounds.map((games) => (
          <div key={games[0].round} className={l.bracketCol}>
            <p className={l.bracketRound} aria-hidden="true">{COLUMN_LABEL(games)}</p>
            <ol className={l.matches} aria-label={`${d.name}: ${COLUMN_LABEL(games)}`}>
              {/* the final first in its column: it's the game everyone looks for */}
              {[...games].sort((a, b) => (a.stage === 'final' ? -1 : b.stage === 'final' ? 1 : a.slot - b.slot)).map((g) => (
                <MatchCard
                  key={gameKey(g)}
                  m={byKey.get(gameKey(g)) ?? unplayed(g, d.id)}
                  names={names}
                  day={day}
                  title={variant === 'board' ? gameShort(g) : gameLabel(g)}
                  waiting={[sourceLabel(g.a), sourceLabel(g.b)]}
                  seedOf={seedOf}
                />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
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
  const podium = medals(d, tiebreakers)
  const medalOf = new Map(podium.map((m) => [m.teamId, m.place]))
  // pool rounds list the round robin; the bracket shows the playoff games
  const pool = d.matches.filter((m) => m.stage === 'pool')
  const drawn = playoffGames(d).length > 0
  // once drawn, the bracket is what people look for: on the venue board it replaces the pool round,
  // on the page and print it comes before the pool rounds (a preview of an undrawn one comes after)
  const boardBracket = variant === 'board' && drawn
  const bracket = <Bracket d={d} names={names} id={id} Sub={Sub} day={day} variant={variant} />

  return (
    <article className={`card ${l.division}`} data-state={state} data-variant={variant} data-many={d.teams.length > 6 || undefined} aria-labelledby={id}>
      <header className={l.divHead}>
        <H id={id} className={l.divName}>{d.name}</H>
        <p className={l.status} data-state={state}>
          {state === 'live' && <span className="live-dot" aria-hidden="true" />}
          {status}
        </p>
        <p className={l.divMeta}>
          {FORMAT_LABELS[d.format]} · {plural(d.teams.length, 'team')} · Games to {d.gamesTo}{d.winBy2 ? ', win by 2' : ''}
          {d.playoffs !== 'none' && ` · Top ${d.playoffs === 'top8' ? 8 : 4} playoffs`}
        </p>
      </header>

      {podium.length > 0 && (
        <ol className={l.podium} aria-label={`${d.name} medals`}>
          {podium.map((m) => {
            const who = players.get(m.teamId)
            const name = names.get(m.teamId) ?? ''
            return (
              <li key={m.place} data-medal={m.place}>
                <span className={l.medal} aria-hidden="true">{MEDAL_ICON[m.place]}</span>
                <span className={l.podiumText}>
                  <span className={l.podiumPlace}>{MEDAL_LABELS[m.place]}<span className="sr">: </span></span>
                  <strong>{name}</strong>
                  {who && who !== name && <span className={l.players}>{who}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {variant !== 'board' && drawn && bracket}

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
                    <tr key={s.teamId} data-top={ranked && s.rank === 1} data-medal={medalOf.get(s.teamId)}>
                      <td className={l.rank}>
                        {ranked ? s.rank : <><span aria-hidden="true">–</span><span className="sr">Not ranked yet</span></>}
                        {medalOf.has(s.teamId) && <span className="sr"> ({MEDAL_LABELS[medalOf.get(s.teamId)!]})</span>}
                      </td>
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
            {boardBracket ? bracket : shownGroups(pool, variant).map((g) => (
              <div key={g.key} className={l.round}>
                <Sub id={`${id}-${g.key}`} className={l.roundName}>{g.label}</Sub>
                <ol className={l.matches} aria-labelledby={`${id}-${g.key}`}>
                  {g.matches.map((m) => <MatchCard key={m.id} m={m} names={names} day={day} />)}
                </ol>
              </div>
            ))}
          </div>
          {variant !== 'board' && !drawn && bracket}
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
