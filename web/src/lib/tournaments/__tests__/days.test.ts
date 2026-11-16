import { describe, expect, it } from 'vitest'
import { addDaysIso, autoDateLabel, dayLabel, normalizeDays } from '../days'

describe('tournament days', () => {
  it('labels a tournament by its days', () => {
    expect(autoDateLabel([])).toBe('Date to be announced')
    expect(autoDateLabel(['2026-10-17'])).toBe('Sat, Oct 17, 2026')
    expect(autoDateLabel(['2026-06-13', '2026-06-14'])).toBe('Jun 13–14, 2026')
    expect(autoDateLabel(['2026-06-30', '2026-07-01'])).toBe('Jun 30–Jul 1, 2026')
  })

  it('labels one day for a division heading', () => {
    expect(dayLabel('2026-11-08')).toBe('Sun, Nov 8')
  })

  it('keeps days unique and in order', () => {
    expect(normalizeDays(['2026-06-14', '2026-06-13', '2026-06-14'])).toEqual(['2026-06-13', '2026-06-14'])
  })

  it('adds days across a month end', () => {
    expect(addDaysIso('2026-06-30', 1)).toBe('2026-07-01')
  })
})
