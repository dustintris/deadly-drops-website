import { describe, expect, it } from 'vitest'
import { countdownParts, daysUntil, startLabel, tournamentStart } from '../countdown'

type Div = { dayIndex: number; startTime: string }
const t = (days: string[], startTime?: string, divisions: Div[] = []) => ({ days, info: { startTime }, divisions })

describe('tournamentStart', () => {
  it('reads a summer start in Pacific Daylight Time (UTC-7)', () => {
    expect(tournamentStart(t(['2026-06-13'], '08:00'))).toEqual({ at: '2026-06-13T15:00:00.000Z', timeKnown: true })
  })

  it('reads a winter start in Pacific Standard Time (UTC-8)', () => {
    expect(tournamentStart(t(['2026-12-05'], '08:00'))).toEqual({ at: '2026-12-05T16:00:00.000Z', timeKnown: true })
  })

  it('is right on the days the clocks change', () => {
    // 2026: clocks go forward on Sunday 8 March and back on Sunday 1 November, both at 2 AM
    expect(tournamentStart(t(['2026-03-08'], '08:00'))?.at).toBe('2026-03-08T15:00:00.000Z')
    expect(tournamentStart(t(['2026-11-01'], '08:00'))?.at).toBe('2026-11-01T16:00:00.000Z')
  })

  it('gives the same instant whatever time zone the server runs in', () => {
    const before = process.env.TZ
    try {
      process.env.TZ = 'Asia/Tokyo'
      expect(tournamentStart(t(['2026-12-05'], '08:00'))?.at).toBe('2026-12-05T16:00:00.000Z')
      process.env.TZ = 'UTC'
      expect(tournamentStart(t(['2026-06-13'], '23:30'))?.at).toBe('2026-06-14T06:30:00.000Z')
    } finally {
      if (before === undefined) delete process.env.TZ
      else process.env.TZ = before
    }
  })

  it('prefers the tournament start time over the divisions', () => {
    const start = tournamentStart(t(['2026-12-05'], '09:30', [{ dayIndex: 0, startTime: '07:00' }]))
    expect(start).toEqual({ at: '2026-12-05T17:30:00.000Z', timeKnown: true })
  })

  it('otherwise uses the earliest division on the first day, ignoring other days', () => {
    const divisions = [
      { dayIndex: 0, startTime: '10:00' },
      { dayIndex: 1, startTime: '07:00' },
      { dayIndex: 0, startTime: '08:30' },
      { dayIndex: 0, startTime: '13:15' },
    ]
    expect(tournamentStart(t(['2026-12-05', '2026-12-06'], undefined, divisions))).toEqual({ at: '2026-12-05T16:30:00.000Z', timeKnown: true })
    // an empty start time counts as not set
    expect(tournamentStart(t(['2026-12-05', '2026-12-06'], '', divisions))?.at).toBe('2026-12-05T16:30:00.000Z')
  })

  it('without any time, starts at midnight club time and says the time is unknown', () => {
    const onlyLater = [{ dayIndex: 1, startTime: '08:00' }]
    expect(tournamentStart(t(['2026-12-05', '2026-12-06'], undefined, onlyLater))).toEqual({ at: '2026-12-05T08:00:00.000Z', timeKnown: false })
    expect(tournamentStart(t(['2026-06-13']))).toEqual({ at: '2026-06-13T07:00:00.000Z', timeKnown: false })
  })

  it('is null while the date is not announced (or not a date)', () => {
    expect(tournamentStart(t([], '08:00', [{ dayIndex: 0, startTime: '08:00' }]))).toBeNull()
    expect(tournamentStart(t(['soon'], '08:00'))).toBeNull()
  })
})

describe('startLabel', () => {
  it('names the day and time in club time', () => {
    expect(startLabel({ at: '2026-12-05T16:00:00.000Z', timeKnown: true })).toBe('Saturday, December 5 at 8:00 AM')
    expect(startLabel({ at: '2026-06-13T20:30:00.000Z', timeKnown: true })).toBe('Saturday, June 13 at 1:30 PM')
  })

  it('leaves the time out when it is not known', () => {
    expect(startLabel({ at: '2026-12-05T08:00:00.000Z', timeKnown: false })).toBe('Saturday, December 5')
  })
})

describe('countdownParts', () => {
  it('splits a duration into days, hours, minutes and seconds', () => {
    const ms = ((((2 * 24 + 3) * 60 + 4) * 60) + 5) * 1000
    expect(countdownParts(ms)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 })
    expect(countdownParts(86_400_000)).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0 })
  })

  it('rounds partial seconds down', () => {
    expect(countdownParts(59_999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 59 })
    expect(countdownParts(999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })

  it('is all zeros once the start has passed (or for nonsense)', () => {
    const zero = { days: 0, hours: 0, minutes: 0, seconds: 0 }
    expect(countdownParts(0)).toEqual(zero)
    expect(countdownParts(-1)).toEqual(zero)
    expect(countdownParts(-90_061_000)).toEqual(zero)
    expect(countdownParts(Number.NaN)).toEqual(zero)
  })
})

describe('daysUntil', () => {
  const start = '2026-12-05T08:00:00.000Z' // midnight, 5 December, club time

  it('counts calendar days on the club calendar, not 24-hour blocks', () => {
    // 11:30 PM on 17 November in Chula Vista is already the 18th in UTC
    expect(daysUntil(start, Date.parse('2026-11-18T07:30:00.000Z'))).toBe(18)
    expect(daysUntil(start, Date.parse('2026-11-18T08:00:00.000Z'))).toBe(17)
    // the evening before is one day to go
    expect(daysUntil(start, Date.parse('2026-12-05T07:59:00.000Z'))).toBe(1)
  })

  it('works across a clock change', () => {
    expect(daysUntil('2026-11-02T08:00:00.000Z', Date.parse('2026-10-31T07:00:00.000Z'))).toBe(2)
  })
})
