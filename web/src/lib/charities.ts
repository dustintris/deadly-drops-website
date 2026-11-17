/**
 * Small pure helpers for the charities the tournaments play for (content section `charities`).
 * Client-safe: used by the public pages and the admin editor.
 */
import type { CharityT } from './content-schema'

/** The charities a tournament plays for, in the admin's order (usually one, possibly none). */
export function charitiesForTournament(charities: readonly CharityT[], slug: string): CharityT[] {
  return charities.filter((c) => c.tournaments.includes(slug))
}

/** Where a charity's full story is: its own section of the Charity page. */
export const charityHref = (c: Pick<CharityT, 'slug'>) => `/charity/#${charityAnchor(c)}`
/** The id of a charity's section on /charity/ (prefixed, so a slug like "main" can't clash with the page's own ids). */
export const charityAnchor = (c: Pick<CharityT, 'slug'>) => `charity-${c.slug}`

/**
 * A readable name for the charity's website: "https://www.us4warriors.org" for "Us4Warriors" gives
 * "Us4Warriors.org" (the charity's own capitals when the address is its name), otherwise the bare host.
 */
export function websiteLabel(url: string, name: string): string {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
  const [first, ...rest] = host.split('.')
  const squashed = name.replace(/[^A-Za-z0-9]/g, '')
  return rest.length && squashed.toLowerCase() === first.toLowerCase() ? [squashed, ...rest].join('.') : host
}
