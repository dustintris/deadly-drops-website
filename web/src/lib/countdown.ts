/**
 * The countdown to a tournament's start. Tournament days and times are wall-clock values in the
 * club's time zone (Chula Vista: America/Los_Angeles); these helpers turn them into real instants
 * with Intl, so the answer is DST-correct and the same whatever time zone the server or browser is in.
 */

const CLUB_TZ = 'America/Los_Angeles'
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

type StartInput = {
  days: string[]
  info: { startTime?: string }
  divisions: { dayIndex: number; startTime: string }[]
}

export type TournamentStart = {
  /** The start as a UTC instant (ISO string). */
  at: string
  /** false when no start time is set: `at` is then midnight (club time) of the first day. */
  timeKnown: boolean
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number }

// built once: creating Intl formatters is the slow part
const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: CLUB_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})
const labelFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: CLUB_TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
})

const partsOf = (fmt: Intl.DateTimeFormat, instant: number) => {
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const p of fmt.formatToParts(new Date(instant))) out[p.type] = p.value
  return out
}
const num = (s: string | undefined) => parseInt(s ?? '0', 10)

/** The club's wall clock at an instant, read back as if it were UTC (Date.UTC of the local fields). */
function clubWallAsUtc(instant: number): number {
  const p = partsOf(wallClock, instant)
  return Date.UTC(num(p.year), num(p.month) - 1, num(p.day), num(p.hour), num(p.minute), num(p.second))
}

/** How far the club's clock is ahead of UTC at an instant, in ms (PDT: -7h, PST: -8h). */
const clubOffset = (instant: number) => Math.round((clubWallAsUtc(instant) - instant) / 60_000) * 60_000

/** A club wall-clock date and time as a UTC instant (ms). */
function clubTimeToUtc(y: number, m: number, d: number, hh: number, mm: number): number {
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  // first guess with the offset at the wall time read as UTC, then correct once in case a DST change lies between
  const guess = wall - clubOffset(wall)
  const offset = clubOffset(guess)
  return wall - offset
}

const minutesOf = (hhmm: string): number | null => {
  const m = TIME_RE.exec(hhmm)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
}

/**
 * When a tournament starts: its first day at `info.startTime`, else at the earliest first-day division,
 * else at midnight with `timeKnown: false` (the time isn't announced yet). null without a (valid) date.
 */
export function tournamentStart(t: StartInput): TournamentStart | null {
  const date = t.days.length ? DATE_RE.exec(t.days[0]) : null
  if (!date) return null

  let minutes = t.info.startTime ? minutesOf(t.info.startTime) : null
  if (minutes === null) {
    for (const d of t.divisions) {
      if (d.dayIndex !== 0) continue
      const m = minutesOf(d.startTime)
      if (m !== null && (minutes === null || m < minutes)) minutes = m
    }
  }
  const timeKnown = minutes !== null
  const total = minutes ?? 0
  const ms = clubTimeToUtc(parseInt(date[1], 10), parseInt(date[2], 10), parseInt(date[3], 10), Math.floor(total / 60), total % 60)
  return { at: new Date(ms).toISOString(), timeKnown }
}

/** "Saturday, December 5 at 8:00 AM" (club time), or just "Saturday, December 5" when the time isn't known. */
export function startLabel(start: TournamentStart): string {
  const p = partsOf(labelFormat, Date.parse(start.at))
  const date = `${p.weekday}, ${p.month} ${p.day}`
  // assembled by hand: newer ICU puts a narrow no-break space before AM/PM
  return start.timeKnown ? `${date} at ${p.hour}:${p.minute} ${p.dayPeriod}` : date
}

/** Whole days, hours, minutes and seconds left in `ms`; all zero once it has passed. */
export function countdownParts(ms: number): CountdownParts {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor(total / 3_600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  }
}

/** Calendar days from `now` to the instant `at`, counted on the club's calendar (tomorrow = 1, whatever the hour). */
export function daysUntil(at: string, now: number): number {
  const day = (instant: number) => {
    const p = partsOf(wallClock, instant)
    return Date.UTC(num(p.year), num(p.month) - 1, num(p.day))
  }
  return Math.round((day(Date.parse(at)) - day(now)) / 86_400_000)
}
