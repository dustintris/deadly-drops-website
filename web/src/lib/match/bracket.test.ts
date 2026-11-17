import { describe, expect, it } from 'vitest'
import {
  bracketPlan, gameKey, outcome, planOf, playoffCourt, playoffMedals, resolveBracket, sourceLabel,
  type PlayedGame, type PlayoffStage,
} from './bracket'

const game = (stage: PlayoffStage, slot: number, teamA: number | null, teamB: number | null, scoreA: number | null = null, scoreB: number | null = null): PlayedGame => ({
  stage, slot, teamA, teamB, scoreA, scoreB, status: scoreA === null ? 'scheduled' : 'final',
})

describe('bracketPlan', () => {
  it('top 4: 1 v 4 and 2 v 3, then the final', () => {
    const plan = bracketPlan('top4', 'standings')
    expect(plan.map(gameKey)).toEqual(['sf1', 'sf2', 'final1'])
    expect(plan[0]).toMatchObject({ round: 1, a: { seed: 1 }, b: { seed: 4 } })
    expect(plan[1]).toMatchObject({ round: 1, a: { seed: 2 }, b: { seed: 3 } })
    expect(plan[2]).toMatchObject({ round: 2, a: { winnerOf: { stage: 'sf', slot: 1 } }, b: { winnerOf: { stage: 'sf', slot: 2 } } })
  })

  it('top 8 keeps the top two seeds apart until the final, with a bronze match when chosen', () => {
    const plan = bracketPlan('top8', 'match')
    expect(plan.map(gameKey)).toEqual(['qf1', 'qf2', 'qf3', 'qf4', 'sf1', 'sf2', 'bronze1', 'final1'])
    const seeds = plan.filter((g) => g.stage === 'qf').map((g) => [('seed' in g.a && g.a.seed), ('seed' in g.b && g.b.seed)])
    expect(seeds).toEqual([[1, 8], [4, 5], [2, 7], [3, 6]])
    expect(plan.find((g) => g.stage === 'bronze')).toMatchObject({ round: 3, a: { loserOf: { stage: 'sf', slot: 1 } } })
  })

  it('reads the drawn shape back from stored games', () => {
    expect(planOf([{ stage: 'qf' }, { stage: 'bronze' }]).map(gameKey)).toEqual(bracketPlan('top8', 'match').map(gameKey))
    expect(planOf([{ stage: 'sf' }, { stage: 'final' }]).map(gameKey)).toEqual(['sf1', 'sf2', 'final1'])
  })
})

describe('resolveBracket', () => {
  const seeds = [10, 20, 30, 40, 50, 60, 70, 80]

  it('fills the first round from the seeds and leaves later rounds empty', () => {
    const r = resolveBracket(bracketPlan('top8', 'match'), seeds, [])
    expect(r.get('qf1')).toEqual({ teamA: 10, teamB: 80 })
    expect(r.get('qf2')).toEqual({ teamA: 40, teamB: 50 })
    expect(r.get('sf1')).toEqual({ teamA: null, teamB: null })
  })

  it('leaves everything empty while pool play is unfinished', () => {
    const r = resolveBracket(bracketPlan('top4', 'match'), null, [])
    expect([...r.values()].every((x) => x.teamA === null && x.teamB === null)).toBe(true)
  })

  it('sends winners on and semifinal losers to the bronze match', () => {
    const plan = bracketPlan('top4', 'match')
    const played = [game('sf', 1, 10, 40, 15, 9), game('sf', 2, 20, 30, 12, 15)]
    const r = resolveBracket(plan, seeds.slice(0, 4), played)
    expect(r.get('final1')).toEqual({ teamA: 10, teamB: 30 })
    expect(r.get('bronze1')).toEqual({ teamA: 40, teamB: 20 })
  })

  it('does not advance anyone from a game still being played', () => {
    const live: PlayedGame = { ...game('sf', 1, 10, 40, 14, 9), status: 'live' }
    const r = resolveBracket(bracketPlan('top4', 'standings'), seeds.slice(0, 4), [live])
    expect(r.get('final1')).toEqual({ teamA: null, teamB: null })
  })
})

describe('outcome', () => {
  it('ignores ties and unfinished games', () => {
    expect(outcome(game('final', 1, 1, 2, 7, 7))).toEqual({ winner: null, loser: null })
    expect(outcome(undefined)).toEqual({ winner: null, loser: null })
    expect(outcome(game('final', 1, 1, 2, 9, 15))).toEqual({ winner: 2, loser: 1 })
  })
})

describe('playoffCourt', () => {
  it('spreads a round over the courts and puts the final on the first court', () => {
    const plan = bracketPlan('top8', 'match')
    const court = (key: string, first: number, count: number) => playoffCourt(plan, plan.find((g) => gameKey(g) === key)!, first, count)
    expect(['qf1', 'qf2', 'qf3', 'qf4'].map((k) => court(k, 3, 2))).toEqual([3, 4, 3, 4])
    expect(court('final1', 3, 2)).toBe(3)
    expect(court('bronze1', 3, 2)).toBe(4)
    expect(court('bronze1', 5, 1)).toBe(5)
  })
})

describe('sourceLabel', () => {
  it('says where an empty side comes from', () => {
    expect(sourceLabel({ seed: 1 })).toBe('1st in pool')
    expect(sourceLabel({ winnerOf: { stage: 'qf', slot: 2 } })).toBe('Winner QF 2')
    expect(sourceLabel({ loserOf: { stage: 'sf', slot: 1 } })).toBe('Loser SF 1')
  })
})

describe('playoffMedals', () => {
  const pool = [10, 20, 30, 40]

  it('gives gold and silver from the final, bronze from the bronze match', () => {
    const played = [game('sf', 1, 10, 40, 15, 9), game('sf', 2, 20, 30, 12, 15), game('bronze', 1, 40, 20, 15, 13), game('final', 1, 10, 30, 11, 15)]
    expect(playoffMedals(played, pool)).toEqual([
      { place: 'gold', teamId: 30 }, { place: 'silver', teamId: 10 }, { place: 'bronze', teamId: 40 },
    ])
  })

  it('without a bronze match, bronze goes to the semifinal loser ranked higher in the pool', () => {
    const played = [game('sf', 1, 10, 40, 15, 9), game('sf', 2, 20, 30, 12, 15), game('final', 1, 10, 30)]
    expect(playoffMedals(played, pool)).toEqual([{ place: 'bronze', teamId: 20 }])
  })

  it('gives each medal as soon as it is decided, and none before', () => {
    const played = [game('sf', 1, 10, 40, 15, 9), game('sf', 2, 20, 30), game('bronze', 1, 40, null), game('final', 1, 10, null)]
    expect(playoffMedals(played, pool)).toEqual([])
  })
})
