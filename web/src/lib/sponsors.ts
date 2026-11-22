/**
 * Small pure helpers for the club's sponsors (content section `sponsors`).
 * Client-safe: used by the Sponsors page, the tournament pages and their tests.
 */
import { SPONSOR_LEVELS, type SponsorLevel, type SponsorT } from './content-schema'

export type SponsorGroup = { level: SponsorLevel; sponsors: SponsorT[] }

const rank = (level: SponsorLevel) => SPONSOR_LEVELS.indexOf(level)

/**
 * The visible sponsors that ticked a tournament, biggest level first (Title, Gold, ...) and in the owner's order
 * within a level. Matches the whole web address, never part of one.
 */
export function sponsorsForTournament(sponsors: readonly SponsorT[], slug: string): SponsorT[] {
  // Array.prototype.sort is stable, so the owner's order survives within each level
  return sponsors.filter((s) => s.visible && s.tournaments.includes(slug)).sort((a, b) => rank(a.level) - rank(b.level))
}

/** Sponsors in level order (Title first), the owner's order within a level; levels nobody is in are left out. */
export function groupByLevel(sponsors: readonly SponsorT[]): SponsorGroup[] {
  return SPONSOR_LEVELS.map((level) => ({ level, sponsors: sponsors.filter((s) => s.level === level) })).filter((g) => g.sponsors.length > 0)
}

/** The heading of a level's group: "Title sponsor", "Gold sponsors", "Supporters". */
export function levelHeading(level: SponsorLevel, count: number): string {
  const one = count === 1
  if (level === 'Supporter') return one ? 'Supporter' : 'Supporters'
  return `${level} ${one ? 'sponsor' : 'sponsors'}`
}

/** The id of a level's section on /sponsors/ (prefixed, so it can't clash with the page's own ids). */
export const levelAnchor = (level: SponsorLevel) => `sponsors-${level.toLowerCase()}`
/** The id of one sponsor's card on /sponsors/. */
export const sponsorAnchor = (s: Pick<SponsorT, 'id'>) => `sponsor-${s.id}`
/** Where a sponsor's card is: on the Sponsors page. */
export const sponsorHref = (s: Pick<SponsorT, 'id'>) => `/sponsors/#${sponsorAnchor(s)}`

/**
 * The tournaments a sponsor backs, out of the ones shown on the site (pass the visible tournaments), in their order.
 * A ticked tournament that is hidden, or has since been renamed or deleted, is simply not listed.
 */
export function sponsoredTournaments<E extends { slug: string }>(sponsor: Pick<SponsorT, 'tournaments'>, events: readonly E[]): E[] {
  return events.filter((e) => sponsor.tournaments.includes(e.slug))
}

/** Up to two initials for a sponsor without a logo: "Chula Vista Brewing" → "CV", "Acme" → "AC". */
export function sponsorInitials(name: string): string {
  const [first, second] = name.match(/[\p{L}\p{N}]+/gu) ?? []
  if (!first) return '?'
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase()
}
