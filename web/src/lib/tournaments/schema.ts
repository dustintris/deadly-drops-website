import { z } from 'zod'
import { httpsUrl, ImageRef, isoDate, lines, Money, optional, optText, Prize, Slug, text } from '@/lib/content-schema'
import { isMainCourtUrl } from '@/lib/maincourt'

/**
 * Tournament model used by the admin editor and checked on the server before every save.
 * Client-safe (zod only). The database keeps divisions as rows; info and rules as jsonb.
 */

export const DIVISION_FORMATS = ['mixed', 'mens', 'womens', 'open'] as const
export type DivisionFormat = (typeof DIVISION_FORMATS)[number]
export const FORMAT_LABELS: Record<DivisionFormat, string> = { mixed: 'Mixed doubles', mens: 'Men’s doubles', womens: 'Women’s doubles', open: 'Open doubles' }

export const PLAYOFFS = ['none', 'top4', 'top8'] as const
export const PLAYOFF_LABELS: Record<(typeof PLAYOFFS)[number], string> = {
  none: 'No playoffs: medals from the final standings',
  top4: 'Top 4: semifinals and final',
  top8: 'Top 8: quarterfinals, semifinals and final',
}
export const BRONZE = ['standings', 'match'] as const
export const BRONZE_LABELS: Record<(typeof BRONZE)[number], string> = { standings: 'Bronze from the standings', match: 'Third-place (bronze) match' }

export const TIEBREAKERS = ['headToHead', 'pointDiff', 'pointsAgainst', 'pointsFor'] as const
export type Tiebreaker = (typeof TIEBREAKERS)[number]
export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  headToHead: 'Head-to-head',
  pointDiff: 'Point difference',
  pointsAgainst: 'Fewest points against',
  pointsFor: 'Most points for',
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:30.')
const int = (min: number, max: number, label: string) =>
  z.number({ invalid_type_error: `${label}: enter a number.` }).int(`${label}: whole numbers only.`).min(min, `${label} must be at least ${min}.`).max(max, `${label} can be at most ${max}.`)

/** Game rules for the whole tournament; a division can override games-to and games per team. */
export const Rules = z.object({
  gamesTo: int(5, 50, 'Points to win'),
  winBy2: z.boolean(),
  gamesPerTeam: int(1, 30, 'Games per team'),
  tiebreakers: z.array(z.enum(TIEBREAKERS)).min(1).max(4).refine((t) => new Set(t).size === t.length, 'Each tiebreaker can be used once.'),
  playoffGamesTo: int(5, 50, 'Playoff points to win'),
  /** Free-text rules shown on the tournament page: DUPR policy, timing, what to bring… */
  notes: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{4,40}$/), title: text(2, 60, 'Rule title'), text: text(2, 1000, 'Rule text') })).max(20),
})
export type RulesT = z.infer<typeof Rules>

export const DEFAULT_RULES: RulesT = {
  gamesTo: 11,
  winBy2: false,
  gamesPerTeam: 7,
  tiebreakers: ['headToHead', 'pointDiff', 'pointsAgainst', 'pointsFor'],
  playoffGamesTo: 15,
  notes: [],
}

/** A link the general link check already explains (not https://, or a name/password before the host): one message is enough. */
function hasOwnMessage(u: string): boolean {
  if (!u.startsWith('https://')) return true
  try {
    const p = new URL(u)
    return !!p.username || !!p.password
  } catch {
    return true
  }
}

/** Everything the public page shows about a tournament besides its days and divisions. */
export const Info = z.object({
  summary: text(10, 200, 'Summary'),
  dateLabel: text(3, 60, 'Date label'),
  startTime: optional(time),
  venue: optText(120, 'Venue'),
  entryFee: Money,
  entryFeeWithMeal: Money.optional(),
  includes: lines(text(2, 60, 'Included item')).pipe(z.array(z.string()).max(8, 'Up to 8 items.')),
  format: text(3, 120, 'Format summary'),
  prizes: z.array(Prize).max(3).refine((p) => new Set(p.map((x) => x.place)).size === p.length, 'Each place can only appear once.'),
  registrationOpen: z.boolean(),
  /** The tournament's page on Main Court, where all registration happens. */
  registrationUrl: optional(httpsUrl.refine((u) => hasOwnMessage(u) || isMainCourtUrl(u), 'Paste the tournament’s Main Court link (https://maincourt.com/…).')),
  /** Poster or photo shown large on the tournament page. */
  image: ImageRef.optional(),
  /** The tournament's own logo (each event has one); the club logo is used when empty. */
  logo: ImageRef.optional(),
})
  .refine((i) => i.entryFeeWithMeal === undefined || i.entryFeeWithMeal > i.entryFee, { message: 'The with-meal price must be higher than the entry fee.', path: ['entryFeeWithMeal'] })
  // registration happens on Main Court, so an open tournament needs somewhere to send players
  .refine((i) => !i.registrationOpen || !!i.registrationUrl, { message: 'Add the Main Court link before opening registration.', path: ['registrationUrl'] })
export type InfoT = z.infer<typeof Info>

export const DivisionInput = z.object({
  /** Present for a division that already exists; new divisions have none. */
  id: z.number().int().positive().optional(),
  name: text(2, 60, 'Division name'),
  format: z.enum(DIVISION_FORMATS),
  dayIndex: int(0, 6, 'Day'),
  startTime: time,
  minutesPerRound: int(5, 120, 'Minutes per round'),
  firstCourt: int(1, 99, 'First court'),
  courtCount: int(1, 40, 'Number of courts'),
  teamLimit: int(2, 64, 'Team limit').nullable(),
  gamesTo: int(5, 50, 'Points to win').nullable(),
  gamesPerTeam: int(1, 30, 'Games per team').nullable(),
  playoffs: z.enum(PLAYOFFS),
  bronze: z.enum(BRONZE),
})
export type DivisionInputT = z.infer<typeof DivisionInput>

export const TournamentInput = z.object({
  name: text(3, 80, 'Tournament name'),
  slug: Slug,
  /** Days of the tournament, first to last; empty while the date isn't announced. */
  days: z.array(isoDate).max(7, 'Up to 7 days.'),
  featured: z.boolean(),
  visible: z.boolean(),
  info: Info,
  rules: Rules,
  divisions: z.array(DivisionInput).max(40, 'Up to 40 divisions.'),
}).superRefine((t, ctx) => {
  if (new Set(t.days).size !== t.days.length) ctx.addIssue({ code: 'custom', path: ['days'], message: 'Each day can only be listed once.' })
  const dayCount = Math.max(1, t.days.length)
  t.divisions.forEach((d, i) => {
    if (d.dayIndex >= dayCount) ctx.addIssue({ code: 'custom', path: ['divisions', i, 'dayIndex'], message: 'Pick one of the tournament’s days.' })
  })
  const names = t.divisions.map((d) => d.name.toLowerCase())
  names.forEach((n, i) => {
    if (names.indexOf(n) !== i) ctx.addIssue({ code: 'custom', path: ['divisions', i, 'name'], message: 'Two divisions have this name.' })
  })
})
export type TournamentInputT = z.infer<typeof TournamentInput>
