/**
 * Playoff brackets. The top 4 or top 8 of the pool standings play single-elimination games:
 *
 *   top 4: SF1 = 1 v 4, SF2 = 2 v 3, then the final (and a bronze match between the SF losers, if chosen)
 *   top 8: QF1 = 1 v 8, QF2 = 4 v 5, QF3 = 2 v 7, QF4 = 3 v 6; SF1 = W QF1 v W QF2, SF2 = W QF3 v W QF4, …
 *
 * so the top two seeds can only meet in the final. Every playoff slot knows where its team comes
 * from (a seed, or the winner or loser of an earlier game); the teams themselves are always worked
 * out again from the results, never trusted from storage. Pure: no framework or database imports.
 */

export type PlayoffSize = 'top4' | 'top8'
export type BronzeMode = 'standings' | 'match'
export type PlayoffStage = 'qf' | 'sf' | 'final' | 'bronze'

export type SlotRef = { stage: PlayoffStage; slot: number }
/** Where one side of a playoff game gets its team. */
export type Source = { seed: number } | { winnerOf: SlotRef } | { loserOf: SlotRef }

export interface BracketGame {
  stage: PlayoffStage
  /** 1-based position within the stage (SF1, SF2…) */
  slot: number
  /** playing order: 1 for the first playoff round; the final and bronze match share the last */
  round: number
  a: Source
  b: Source
}

/** A stored playoff game, as far as the bracket cares. */
export interface PlayedGame {
  stage: PlayoffStage
  slot: number
  teamA: number | null
  teamB: number | null
  scoreA: number | null
  scoreB: number | null
  status: 'scheduled' | 'live' | 'final'
}

export const BRACKET_SIZE: Record<PlayoffSize, number> = { top4: 4, top8: 8 }

const ref = (stage: PlayoffStage, slot: number): SlotRef => ({ stage, slot })
export const gameKey = (g: { stage: string; slot: number }) => `${g.stage}${g.slot}`

/** The games of a bracket, in playing order. */
export function bracketPlan(size: PlayoffSize, bronze: BronzeMode): BracketGame[] {
  const games: BracketGame[] = []
  let semis: [Source, Source][]
  if (size === 'top8') {
    const qf: [number, number][] = [[1, 8], [4, 5], [2, 7], [3, 6]]
    qf.forEach(([a, b], i) => games.push({ stage: 'qf', slot: i + 1, round: 1, a: { seed: a }, b: { seed: b } }))
    semis = [
      [{ winnerOf: ref('qf', 1) }, { winnerOf: ref('qf', 2) }],
      [{ winnerOf: ref('qf', 3) }, { winnerOf: ref('qf', 4) }],
    ]
  } else {
    semis = [
      [{ seed: 1 }, { seed: 4 }],
      [{ seed: 2 }, { seed: 3 }],
    ]
  }
  const sfRound = size === 'top8' ? 2 : 1
  semis.forEach(([a, b], i) => games.push({ stage: 'sf', slot: i + 1, round: sfRound, a, b }))
  if (bronze === 'match') games.push({ stage: 'bronze', slot: 1, round: sfRound + 1, a: { loserOf: ref('sf', 1) }, b: { loserOf: ref('sf', 2) } })
  games.push({ stage: 'final', slot: 1, round: sfRound + 1, a: { winnerOf: ref('sf', 1) }, b: { winnerOf: ref('sf', 2) } })
  return games
}

/** The bracket shape that stored games were drawn with (so a later settings change can't confuse it). */
export function planOf(stored: { stage: string }[]): BracketGame[] {
  const size: PlayoffSize = stored.some((g) => g.stage === 'qf') ? 'top8' : 'top4'
  const bronze: BronzeMode = stored.some((g) => g.stage === 'bronze') ? 'match' : 'standings'
  return bracketPlan(size, bronze)
}

/** Winner and loser of a finished game; nulls while it's still being played. */
export function outcome(g: Pick<PlayedGame, 'teamA' | 'teamB' | 'scoreA' | 'scoreB' | 'status'> | undefined) {
  if (!g || g.status !== 'final' || g.teamA === null || g.teamB === null || g.scoreA === null || g.scoreB === null || g.scoreA === g.scoreB) {
    return { winner: null, loser: null }
  }
  return g.scoreA > g.scoreB ? { winner: g.teamA, loser: g.teamB } : { winner: g.teamB, loser: g.teamA }
}

/**
 * Which teams belong in every game of the bracket, given the seeds (team ids in seed order, or
 * null while pool play isn't finished) and the games played so far. Empty sides are null.
 */
export function resolveBracket(plan: BracketGame[], seeds: number[] | null, played: PlayedGame[]) {
  const byKey = new Map(played.map((g) => [gameKey(g), g]))
  const pick = (s: Source): number | null => {
    if ('seed' in s) return seeds?.[s.seed - 1] ?? null
    if ('winnerOf' in s) return outcome(byKey.get(gameKey(s.winnerOf))).winner
    return outcome(byKey.get(gameKey(s.loserOf))).loser
  }
  return new Map(plan.map((g) => [gameKey(g), { teamA: pick(g.a), teamB: pick(g.b) }]))
}

/**
 * Courts for the playoff games: each round's games spread over the division's courts. The final
 * takes the first court (the show court); a bronze match played alongside takes the next one.
 */
export function playoffCourt(plan: BracketGame[], game: BracketGame, firstCourt: number, courtCount: number): number {
  const sameRound = plan.filter((g) => g.round === game.round).sort((x, y) => (x.stage === 'final' ? -1 : y.stage === 'final' ? 1 : x.slot - y.slot))
  const i = sameRound.findIndex((g) => g.stage === game.stage && g.slot === game.slot)
  return firstCourt + (Math.max(0, i) % Math.max(1, courtCount))
}

/** "Quarterfinal 2", "Semifinal 1", "Final", "Bronze match": one game's name. */
export function gameLabel(g: SlotRef): string {
  if (g.stage === 'qf') return `Quarterfinal ${g.slot}`
  if (g.stage === 'sf') return `Semifinal ${g.slot}`
  return g.stage === 'final' ? 'Final' : 'Bronze match'
}

/** The short name for tight spaces (the venue board): "QF 2", "SF 1", "Final", "Bronze". */
export const gameShort = (g: SlotRef) => (g.stage === 'qf' || g.stage === 'sf' ? `${g.stage.toUpperCase()} ${g.slot}` : g.stage === 'final' ? 'Final' : 'Bronze')

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
const SHORT: Record<PlayoffStage, string> = { qf: 'QF', sf: 'SF', final: 'Final', bronze: 'Bronze' }

/** "1st in pool", "Winner QF 2", "Loser SF 1": shown while a side is still empty. */
export function sourceLabel(s: Source): string {
  if ('seed' in s) return `${ORDINAL[s.seed - 1] ?? `#${s.seed}`} in pool`
  const r = 'winnerOf' in s ? s.winnerOf : s.loserOf
  return `${'winnerOf' in s ? 'Winner' : 'Loser'} ${SHORT[r.stage]}${r.stage === 'qf' || r.stage === 'sf' ? ` ${r.slot}` : ''}`
}

export type PlayoffMedal = { place: 'gold' | 'silver' | 'bronze'; teamId: number }

/**
 * Medals from the playoffs, each one as soon as it's decided: gold and silver from the final;
 * bronze from the bronze match, or (no bronze match) the semifinal loser who finished higher in
 * the pool. `poolOrder` is every team id in pool standings order.
 */
export function playoffMedals(played: PlayedGame[], poolOrder: number[]): PlayoffMedal[] {
  const find = (stage: PlayoffStage, slot = 1) => played.find((g) => g.stage === stage && g.slot === slot)
  const out: PlayoffMedal[] = []
  const final = outcome(find('final'))
  if (final.winner !== null && final.loser !== null) {
    out.push({ place: 'gold', teamId: final.winner }, { place: 'silver', teamId: final.loser })
  }
  if (played.some((g) => g.stage === 'bronze')) {
    const b = outcome(find('bronze'))
    if (b.winner !== null) out.push({ place: 'bronze', teamId: b.winner })
  } else {
    const l1 = outcome(find('sf', 1)).loser
    const l2 = outcome(find('sf', 2)).loser
    if (l1 !== null && l2 !== null) {
      const rank = (id: number) => { const i = poolOrder.indexOf(id); return i < 0 ? Infinity : i }
      out.push({ place: 'bronze', teamId: rank(l1) <= rank(l2) ? l1 : l2 })
    }
  }
  return out
}
