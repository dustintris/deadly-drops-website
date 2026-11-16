import { generateExtendedRoundRobin, planRoundRobin } from './extendedRoundRobin'

export interface ScheduledMatch {
  /** 1-based round of the extended round robin. */
  round: number
  /** 1-based time slot; a round with more matches than courts spans several slots. */
  slot: number
  /** Real court number, starting at firstCourt. */
  court: number
  /** 'HH:MM' (24h) start time of the slot. */
  startsAt: string
  teamA: number
  teamB: number
}

export interface ScheduleOptions {
  teamIds: number[]
  gamesPerTeam: number
  /** 'HH:MM' */
  startTime: string
  minutesPerRound: number
  firstCourt: number
  courtCount: number
  /** Makes the draw reproducible (tests). Math.random is used when omitted. */
  seed?: number
}

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Schedule a division: shuffle the teams into a random draw (otherwise
 * generating twice would give the identical schedule), build an extended round
 * robin that reaches gamesPerTeam, then split each round into time slots of at
 * most courtCount matches so no court hosts two matches in one slot.
 * Slot N starts at startTime + (N - 1) * minutesPerRound.
 */
export function scheduleDivision(opts: ScheduleOptions): ScheduledMatch[] {
  const { gamesPerTeam, startTime, minutesPerRound, firstCourt, courtCount, seed } = opts
  const ids = [...opts.teamIds]
  if (ids.length < 2 || courtCount < 1) return []

  const random = seed === undefined ? Math.random : mulberry32(seed)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }

  const rounds = generateExtendedRoundRobin(
    ids.map((_, i) => i),
    gamesPerTeam,
  )
  const matches: ScheduledMatch[] = []
  let slotIndex = 0
  rounds.forEach((round, r) => {
    for (let offset = 0; offset < round.length; offset += courtCount) {
      round.slice(offset, offset + courtCount).forEach(([a, b], i) => {
        matches.push({
          round: r + 1,
          slot: slotIndex + 1,
          court: firstCourt + i,
          startsAt: slotTime24(startTime, minutesPerRound, slotIndex),
          teamA: ids[a],
          teamB: ids[b],
        })
      })
      slotIndex++
    }
  })
  return matches
}

function minutesFromStart(startTime: string, minutesPerRound: number, slotIndex: number): number {
  const [h, m] = startTime.split(':').map((x) => parseInt(x, 10))
  const start = (Number.isNaN(h) ? 10 : h) * 60 + (Number.isNaN(m) ? 0 : m)
  return start + slotIndex * minutesPerRound
}

/** 'HH:MM', wrapping past midnight. */
function slotTime24(startTime: string, minutesPerRound: number, slotIndex: number): string {
  const total = minutesFromStart(startTime, minutesPerRound, slotIndex) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** 'HH:MM' to '8:00 AM'. */
export function formatTime12(hhmm: string): string {
  const total = minutesFromStart(hhmm, 0, 0)
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`
}

/**
 * One-paragraph preview of what generating a schedule will produce, so the
 * director sees the round count before committing.
 */
export function describePlan(teamCount: number, gamesPerTeam: number): string {
  const teams = teamCount
  const target = gamesPerTeam
  const plan = planRoundRobin(teams, target)
  const parts = [
    `${teams} teams: ${plan.rounds} rounds on ${plan.courts} court${plan.courts === 1 ? '' : 's'}, ${plan.gamesEach} games each.`,
  ]
  if (plan.gamesEach === 2 * (teams - 1)) {
    parts.push('Everyone plays everyone twice (a double round robin).')
  } else if (plan.rematchRounds > 0) {
    parts.push(
      `Everyone plays everyone once (${teams - 1} games), then ${plan.rematchRounds} rematch round${plan.rematchRounds === 1 ? '' : 's'} toward the ${target} promised.`,
    )
  } else {
    parts.push('Everyone plays everyone once.')
  }
  if (plan.gamesEach < target && teams - 1 < target) {
    // Parity alternates, so the next number up always shares evenly.
    parts.push(
      `${target} games cannot be shared evenly between ${teams} teams, so each gets ${plan.gamesEach}. Set ${target + 1} to go over instead.`,
    )
  }
  return parts.join(' ')
}
