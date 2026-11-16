/**
 * Round robin schedule generation via the circle method.
 * Pure function, no framework dependencies.
 */

const BYE = -1

/**
 * Generate a round robin schedule for the given team ids.
 *
 * Returns an array of rounds; each round is a list of [teamA, teamB] pairings.
 * With an odd team count, each team sits out exactly one round (bye pairings
 * are omitted from the output).
 */
export function generateRoundRobin(teamIds: number[]): [number, number][][] {
  if (teamIds.length < 2) return []
  const ids = [...teamIds]
  if (ids.length % 2 === 1) ids.push(BYE)

  const n = ids.length
  const half = n / 2
  const rotation = ids.slice(1)
  const rounds: [number, number][][] = []

  for (let r = 0; r < n - 1; r++) {
    const left = [ids[0], ...rotation.slice(0, half - 1)]
    const right = rotation.slice(half - 1).reverse()
    const pairs: [number, number][] = []
    for (let i = 0; i < half; i++) {
      const a = left[i]
      const b = right[i]
      if (a !== BYE && b !== BYE) pairs.push([a, b])
    }
    rounds.push(pairs)
    rotation.push(rotation.shift()!)
  }
  return rounds
}
