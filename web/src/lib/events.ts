import type { ClubEvent } from './types'

export type EventState = 'open' | 'upcoming' | 'past' | 'tba'

/** Today's date in Chula Vista (YYYY-MM-DD), whatever time zone the server runs in. */
export function clubToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Where a tournament stands today, so the site never shows "Register" for an event that is over. */
export function eventState(e: ClubEvent, now = new Date()): EventState {
  if (!e.date) return e.registrationOpen ? 'open' : 'tba'
  const lastDay = e.endDate ?? e.date
  if (lastDay < clubToday(now)) return 'past' // ISO dates compare as strings
  return e.registrationOpen ? 'open' : 'upcoming'
}

export const eventEyebrow = (s: EventState) =>
  s === 'past' ? 'Latest tournament' : s === 'open' ? 'Next up · registration open' : s === 'upcoming' ? 'Next up · registration opens soon' : 'Next up · date to be announced'

/** The main call to action for a tournament. External sign-up pages open in a new tab. */
export function eventCta(e: ClubEvent, s: EventState): { label: string; href: string; external: boolean } {
  if (s === 'past') return { label: 'See photos and stories', href: '/community/', external: false }
  if (s === 'open' && e.registrationUrl) return { label: 'Register now', href: e.registrationUrl, external: true }
  if (s === 'open') return { label: 'Reserve your spot', href: '/tournaments/#register', external: false }
  return { label: 'Get notified', href: '#join-email', external: false }
}
