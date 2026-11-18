import type { SectionKey } from '@/lib/content-schema'

/**
 * Who may see and change what in the admin. Pure and dependency-free: the same rules run on
 * the server (the real check, in every page and action) and in the browser (to hide menu items).
 */

export const AREAS = ['tournaments', 'scoring', 'checkin', 'content', 'shop', 'branding', 'staff'] as const
export type Area = (typeof AREAS)[number]

export const LEVELS = ['none', 'view', 'edit'] as const
export type Level = (typeof LEVELS)[number]

export type Perms = Record<Area, Level>

export const AREA_LABELS: Record<Area, string> = {
  tournaments: 'Tournaments',
  scoring: 'Scoring',
  checkin: 'Check-in',
  content: 'Website content',
  shop: 'Shop',
  branding: 'Logo & colours',
  staff: 'Staff accounts',
}

export const AREA_HELP: Record<Area, string> = {
  tournaments: 'Tournament details, divisions, teams and schedules',
  scoring: 'Enter and correct match scores',
  checkin: 'Check players in on the day',
  content: 'Page text, club info, announcements, community posts, charities, gallery, FAQ, photos, and the Inbox (contact messages and the email list)',
  shop: 'Products and prices',
  branding: 'Logo and theme colours',
  staff: 'Create staff logins and set what each person can do',
}

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 }

/** Anything with an owner flag and permissions: a session, a staff row. */
export type Principal = { isOwner: boolean; perms: Perms }

/** True when this person may do `level` in `area`. The owner may do everything. */
export function can(who: Principal | null | undefined, area: Area, level: Exclude<Level, 'none'> = 'view'): boolean {
  if (!who) return false
  if (who.isOwner) return true
  return RANK[who.perms[area] ?? 'none'] >= RANK[level]
}

/**
 * Can `granter` hand out (or manage someone holding) these permissions? The owner can; anyone
 * else only up to their own level in every area, so a staff manager can't create a login more
 * powerful than themselves and then use it.
 */
export function withinCeiling(granter: Principal, perms: Perms): boolean {
  if (granter.isOwner) return true
  return AREAS.every((a) => RANK[perms[a] ?? 'none'] <= RANK[granter.perms[a] ?? 'none'])
}

/** A complete, valid permissions object from anything (stored JSON, a form): unknown keys and levels are dropped. */
export function normalizePerms(raw: unknown): Perms {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.fromEntries(
    AREAS.map((a) => [a, (LEVELS as readonly string[]).includes(src[a] as string) ? (src[a] as Level) : 'none']),
  ) as Perms
}

const preset = (p: Partial<Perms>) => normalizePerms(p)

/** Starting points offered when creating a login. None of them can manage staff: only the owner grants that. */
export const PRESETS: { key: string; label: string; description: string; perms: Perms }[] = [
  {
    key: 'manager',
    label: 'Manager',
    description: 'Everything except staff accounts',
    perms: preset({ tournaments: 'edit', scoring: 'edit', checkin: 'edit', content: 'edit', shop: 'edit', branding: 'edit' }),
  },
  {
    key: 'director',
    label: 'Tournament director',
    description: 'Runs tournaments: details, scoring and check-in; can look at the website content',
    perms: preset({ tournaments: 'edit', scoring: 'edit', checkin: 'edit', content: 'view', shop: 'view', branding: 'view' }),
  },
  {
    key: 'scorekeeper',
    label: 'Scorekeeper',
    description: 'Enters scores from a phone',
    perms: preset({ scoring: 'edit', tournaments: 'view' }),
  },
  {
    key: 'checkin',
    label: 'Check-in desk',
    description: 'Checks players in on the day',
    perms: preset({ checkin: 'edit', tournaments: 'view' }),
  },
  {
    key: 'content',
    label: 'Content editor',
    description: 'Website pages, news, photos and the shop',
    perms: preset({ content: 'edit', shop: 'edit' }),
  },
]

/** The preset these permissions match exactly, or 'custom'. */
export function presetOf(perms: Perms): string {
  return PRESETS.find((p) => AREAS.every((a) => p.perms[a] === perms[a]))?.key ?? 'custom'
}

/** Which permission area each website-content section belongs to (media = the photo library). */
export const SECTION_AREA: Record<SectionKey | 'media', Area> = {
  settings: 'content',
  theme: 'branding',
  ticker: 'content',
  products: 'shop',
  media: 'content',
  gallery: 'content',
  posts: 'content',
  faqs: 'content',
  charities: 'content',
  pages: 'content',
}

/** The content sections this person may change (and so publish or discard). */
export function editableSections(who: Principal | null | undefined): (SectionKey | 'media')[] {
  return (Object.keys(SECTION_AREA) as (SectionKey | 'media')[]).filter((k) => can(who, SECTION_AREA[k], 'edit'))
}
