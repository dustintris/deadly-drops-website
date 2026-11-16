/**
 * Round robin extended with rematch rounds so an under-filled division still
 * gets the games it was promised. Pure functions, no framework dependencies.
 *
 * The club sells every division as 7 games: 8 teams on 4 courts is a full
 * round robin. With 6 teams a round robin is only 5 games, so rematch rounds
 * are appended until each team has played the promised number. Extra games are
 * shared equally (every team gets the same number of rematches) so standings
 * built on wins and points stay comparable across the division.
 */

import { generateRoundRobin } from './roundRobin'

export type Pairing = [number, number]

export interface RoundRobinPlan {
  /** Games each team plays; see balancedGamesPerTeam for why it can miss the target. */
  gamesEach: number
  rounds: number
  /** Courts the division occupies at once: the games in its fullest round. */
  courts: number
  /** Rounds appended after the single round robin. */
  rematchRounds: number
}

/**
 * Games each team actually plays when `target` games are promised to `n` teams.
 *
 * A full round robin (n - 1 games) is the floor; pools are the answer for a
 * division too large for that, not a shortened draw. Above the floor, extra
 * games are only added when they divide evenly: n teams each playing one more
 * game is n / 2 games, so n * extra must be even. When it is not, the division
 * plays one game short rather than one over, since it still has to fit its
 * time slot.
 */
export function balancedGamesPerTeam(n: number, target: number): number {
  if (n < 2) return 0
  const base = n - 1
  if (target <= base) return base
  const extra = target - base
  return base + ((n * extra) % 2 === 0 ? extra : extra - 1)
}

/**
 * Round robin rounds followed by rematch rounds, until every team has
 * balancedGamesPerTeam(n, gamesPerTeam) games.
 */
export function generateExtendedRoundRobin(teamIds: number[], gamesPerTeam: number): Pairing[][] {
  const n = teamIds.length
  const base = generateRoundRobin(teamIds)
  if (n < 2) return base
  const rounds = [...base]
  let extra = balancedGamesPerTeam(n, gamesPerTeam) - (n - 1)

  // Whole extra round robins first: the circle method packs them into fewer
  // rounds than the first-fit fill below would.
  while (extra >= n - 1) {
    rounds.push(...base)
    extra -= n - 1
  }
  if (extra === 0) return rounds

  if (n % 2 === 0) {
    // Every circle-method round is a perfect matching, so replaying the first
    // `extra` rounds hands each team exactly one more game per round.
    rounds.push(...base.slice(0, extra))
    return rounds
  }

  // Odd count: a circle-method round leaves one team idle, so replaying rounds
  // would give some teams more games than others. Instead pair each team with
  // its neighbours around a circle (step 1, then step 2, ...). Each step is one
  // cycle through all n teams, two games per team, and no two steps below n / 2
  // share a pair. `extra` is even here because n * extra is.
  const extraGames: Pairing[] = []
  for (let step = 1; step <= extra / 2; step++) {
    for (let i = 0; i < n; i++) extraGames.push([teamIds[i], teamIds[(i + step) % n]])
  }
  rounds.push(...packIntoRounds(extraGames, Math.floor(n / 2)))
  return rounds
}

/** First-fit packing: a game goes in the earliest round where both teams are free. */
function packIntoRounds(games: Pairing[], perRound: number): Pairing[][] {
  const rounds: Pairing[][] = []
  const busy: Set<number>[] = []
  for (const [a, b] of games) {
    let r = busy.findIndex((set, i) => rounds[i].length < perRound && !set.has(a) && !set.has(b))
    if (r === -1) {
      r = rounds.length
      rounds.push([])
      busy.push(new Set())
    }
    rounds[r].push([a, b])
    busy[r].add(a).add(b)
  }
  return rounds
}

/** What a division of `teams` teams gets when promised `gamesPerTeam` games. */
export function planRoundRobin(teams: number, gamesPerTeam: number): RoundRobinPlan {
  const rounds = generateExtendedRoundRobin(
    Array.from({ length: teams }, (_, i) => i),
    gamesPerTeam,
  )
  const singleRoundRobin = teams < 2 ? 0 : teams % 2 === 0 ? teams - 1 : teams
  return {
    gamesEach: balancedGamesPerTeam(teams, gamesPerTeam),
    rounds: rounds.length,
    courts: rounds.reduce((max, round) => Math.max(max, round.length), 0),
    rematchRounds: rounds.length - singleRoundRobin,
  }
}
