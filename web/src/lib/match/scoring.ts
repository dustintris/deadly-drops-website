/**
 * Game completion rule. A game is final when:
 *  - one side has reached the target score (11/15/21), AND
 *  - with win-by-2 enabled, that side leads by at least 2.
 *
 * Win-by-2 is pickleball's deuce: at target-1 apiece (e.g. 10-10 in a game
 * to 11) play continues past the target until a team leads by 2 so 11-10
 * is still live and 12-10 ends it. A tied score is never final.
 */
export function isGameComplete(
  scoreA: number,
  scoreB: number,
  target: number,
  winBy2: boolean,
): boolean {
  const high = Math.max(scoreA, scoreB)
  const diff = Math.abs(scoreA - scoreB)
  if (diff === 0) return false
  if (high < target) return false
  return winBy2 ? diff >= 2 : true
}

/** Which side leads: 'A', 'B', or null for a tie. */
export function winnerOf(scoreA: number, scoreB: number): 'A' | 'B' | null {
  if (scoreA === scoreB) return null
  return scoreA > scoreB ? 'A' : 'B'
}
