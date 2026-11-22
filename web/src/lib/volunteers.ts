/**
 * Small pure helpers for the Volunteers page (content section `volunteers`).
 * Client-safe: no data access, so the page and the tests share them.
 */
import { eventState, latestFirst } from './events'
import type { ClubEvent } from './types'

/**
 * The tournaments volunteers can still help at: the `limit` soonest that aren't over (those still without a date
 * count as furthest away), listed the latest first like every tournament list on the site.
 */
export function comingUp(events: readonly ClubEvent[], now = new Date(), limit = 4): ClubEvent[] {
  return events
    .filter((e) => eventState(e, now) !== 'past')
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.date ?? '9999').localeCompare(b.e.date ?? '9999') || a.i - b.i)
    .slice(0, Math.max(0, limit))
    .map((x) => x.e)
    .sort(latestFirst)
}

export type RoleTone = 'dark' | 'accent' | 'card'

/**
 * The colour of a role card on the light wall: mostly white cards with a black one and a pink one in every six,
 * so the grid has the same rhythm as the "How a tournament runs" tiles however many roles there are.
 */
export function roleTone(i: number): RoleTone {
  const k = i % 6
  return k === 0 ? 'dark' : k === 4 ? 'accent' : 'card'
}
