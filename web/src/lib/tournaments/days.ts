/**
 * Tournament days are ISO dates (YYYY-MM-DD) in the club's calendar; each division plays on one
 * of them (its dayIndex). Dates are handled at UTC noon-free midnight so no time zone shifts a day.
 * Ported from the Pickle Match desktop app (model/days.ts).
 */

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10))
  return Date.UTC(y, m - 1, d)
}
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(toUtc(iso)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })

/** The date `n` days after (or before) an ISO date. */
export function addDaysIso(iso: string, n: number): string {
  return new Date(toUtc(iso) + n * 86_400_000).toISOString().slice(0, 10)
}

/** Unique days, earliest first. */
export function normalizeDays(days: string[]): string[] {
  return [...new Set(days)].sort()
}

/** Short day name for a division heading, e.g. "Sat, Nov 8". */
export function dayLabel(iso: string): string {
  return fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** The public date line: "Sat, Oct 17, 2026", "Jun 13–14, 2026", "Jun 30–Jul 1, 2026" or "Date to be announced". */
export function autoDateLabel(days: string[]): string {
  const sorted = normalizeDays(days)
  if (!sorted.length) return 'Date to be announced'
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === last) return fmt(first, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const sameMonth = first.slice(0, 7) === last.slice(0, 7)
  // built by hand: Intl formats "day + year" without a month oddly ("2026 (day: 14)")
  const end = sameMonth ? String(parseInt(last.slice(8, 10), 10)) : fmt(last, { month: 'short', day: 'numeric' })
  return `${fmt(first, { month: 'short', day: 'numeric' })}–${end}, ${last.slice(0, 4)}`
}
