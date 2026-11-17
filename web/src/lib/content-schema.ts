/**
 * The MIS content model. Every owner edit is parsed with these schemas on the server
 * before it is saved, so the public site can trust what it reads.
 */
import { z } from 'zod'

/* ---------- shared field rules ---------- */

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
export const text = (min: number, max: number, label = 'This field') =>
  z.string().transform(clean).pipe(z.string().min(min, `${label} needs at least ${min} characters.`).max(max, `${label} can be at most ${max} characters.`))
export const optText = (max: number, label = 'This field') =>
  z.string().transform(clean).pipe(z.string().max(max, `${label} can be at most ${max} characters.`)).optional()

export const IMAGE_SRC = /^\/(media\/[a-f0-9]{24}\.(jpg|png|webp)|images\/(stand-in|club)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)|logo\.png)$/
export const ImageRef = z.object({
  src: z.string().regex(IMAGE_SRC, 'Choose an image from the media library.'),
  alt: z.string().transform(clean).pipe(z.string().max(160, 'Image description can be at most 160 characters.')),
  position: z.string().regex(/^\d{1,3}% \d{1,3}%$/, 'Focal point must look like "50% 40%".').optional(),
})

export const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes only.').min(2).max(60)
export const Id = z.string().regex(/^[a-z0-9-]{4,40}$/)

/** Dollars, 0–10,000, at most 2 decimals. */
export const Money = z.number({ invalid_type_error: 'Enter an amount like 55 or 55.00.' }).min(0, 'Amount cannot be negative.').max(10000, 'Amount is too large.')
  // compare with a tolerance: 19.99 * 100 is 1998.9999999999998 in floating point
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'Use at most 2 decimal places.')
  .transform((n) => Math.round(n * 100) / 100)

/** Parses what an owner types into a price box: "$1,234.50", "55". */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null
  return Math.round(parseFloat(s) * 100) / 100
}

export const httpsUrl = z.string().trim().max(500).regex(/^https:\/\/[^\s"<>]+$/, 'Links must start with https://')
  // a "user@" part makes a link look like one site and open another (https://us4warriors.org@elsewhere.com)
  // (a link that doesn't parse at all already failed the pattern above: one message is enough)
  .refine((u) => { try { const p = new URL(u); return !p.username && !p.password } catch { return true } }, 'Remove the name or password before the @ in the link.')
const internalOrHttps = z.string().trim().max(500).regex(/^(\/(?!\/)[a-z0-9/#-]*|https:\/\/[^\s"<>]+)$/, 'Use a page path like /tournaments/ or a full https:// link.')
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-03-14.')
  .refine((d) => { const t = new Date(`${d}T00:00:00Z`); return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d }, 'That date does not exist.')
/** lists typed one-per-line: blank lines are ignored instead of failing validation */
export const lines = <T extends z.ZodTypeAny>(item: T) => z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => String(x ?? '').trim() !== '') : v), z.array(item))
export const optional = <T extends z.ZodTypeAny>(s: T) => z.union([s, z.literal('').transform(() => undefined)]).optional()

/* ---------- entities ---------- */

export const SiteSettings = z.object({
  name: text(2, 60, 'Club name'),
  shortName: text(2, 30, 'Short name'),
  tagline: text(0, 120, 'Tagline'),
  city: text(2, 60, 'City'),
  postcode: z.string().regex(/^\d{5}$/, 'Use a 5-digit ZIP code.'),
  email: z.string().trim().email('Enter an email like info@example.com.'),
  phone: z.string().transform(clean).pipe(z.string().refine((v) => v === '' || (/^[+()\d .-]{7,24}$/.test(v) && v.replace(/\D/g, '').length >= 10), 'Enter a full phone number with area code, like (619) 555-0123, or leave it empty to hide it.')),
  // derived from phone below; whatever the browser sends is ignored
  phoneHref: z.string().optional(),
  about: text(20, 800, 'About text'),
  highlights: lines(text(2, 60, 'Highlight')).pipe(z.array(z.string()).max(6, 'Up to 6 highlights.')),
  howItWorks: z.array(z.object({ title: text(2, 40, 'Step title'), body: text(5, 240, 'Step text') })).length(3, 'There are always 3 steps.'),
  favorites: z.array(z.object({ title: text(2, 40, 'Title'), body: text(5, 240, 'Text') })).max(6),
  aboutPoints: z.array(z.object({ title: text(2, 40, 'Title'), body: text(5, 300, 'Text') })).max(6).default([]),
  social: z.object({ instagram: optional(httpsUrl), facebook: optional(httpsUrl), youtube: optional(httpsUrl), tiktok: optional(httpsUrl) }).default({}),
  notice: z.object({ enabled: z.boolean(), text: text(0, 140, 'Notice'), href: optional(internalOrHttps) }),
  shop: z.object({ memberDiscount: z.number().min(0).max(0.5, 'Discount can be at most 50%.'), pickupNote: text(0, 80, 'Pickup note') }),
}).transform((s) => {
  const d = s.phone.replace(/\D/g, '')
  return { ...s, phoneHref: d ? `tel:+${d.length === 10 ? '1' + d : d}` : '' }
})

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/
const ThemeColours = z.object({
  bg: z.string(), surface: z.string(), surface2: z.string(), paper: z.string(), paperCard: z.string(), ink: z.string(), inkDark: z.string(),
  accent: z.string(), accentSoft: z.string(), accentDeep: z.string(), onAccent: z.string(), accentTint: z.string(),
  danger: z.string(), dangerOnLight: z.string(), logoPlate: z.string(),
})
export type ThemeColourKey = keyof z.infer<typeof ThemeColours>
export const THEME_COLOUR_KEYS = Object.keys(ThemeColours.shape) as ThemeColourKey[]

export const Theme = ThemeColours.extend({
  /** the club logo; empty = the bundled badge (/logo.png). Optional, so themes saved before it existed still parse. */
  logo: ImageRef.optional(),
}).superRefine((t, ctx) => {
  // colours only: the logo is an image and ImageRef already checks it
  for (const k of THEME_COLOUR_KEYS) if (!HEX_COLOUR.test(t[k])) ctx.addIssue({ code: 'custom', path: [k], message: 'Use a colour like #C6F24E.' })
  for (const issue of themeContrastIssues(t)) ctx.addIssue({ code: 'custom', path: [issue.key], message: issue.message })
})

export const Prize = z.object({ place: z.enum(['Gold', 'Silver', 'Bronze']), amount: Money })
export const ClubEvent = z.object({
  id: Id,
  slug: Slug,
  name: text(3, 80, 'Event name'),
  summary: text(10, 200, 'Summary'),
  date: isoDate.nullable(),
  /** last day of a multi-day tournament (empty = one day) */
  endDate: optional(isoDate),
  dateLabel: text(3, 60, 'Date label'),
  startTime: optional(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:30.')),
  location: optText(120, 'Location'),
  entryFee: Money,
  entryFeeWithMeal: Money.optional(),
  includes: lines(text(2, 60, 'Included item')).pipe(z.array(z.string()).max(8, 'Up to 8 items.')),
  format: text(3, 120, 'Format'),
  prizes: z.array(Prize).max(3).refine((p) => new Set(p.map((x) => x.place)).size === p.length, 'Each place can only appear once.'),
  registrationOpen: z.boolean(),
  registrationUrl: optional(httpsUrl),
  image: ImageRef.optional(),
  /** the tournament's own logo */
  logo: ImageRef.optional(),
  featured: z.boolean(),
  visible: z.boolean(),
}).refine((e) => e.entryFeeWithMeal === undefined || e.entryFeeWithMeal > e.entryFee, { message: 'The with-meal price must be higher than the entry fee.', path: ['entryFeeWithMeal'] })
  .refine((e) => !e.endDate || (!!e.date && e.endDate >= e.date), { message: 'The last day must be on or after the first day.', path: ['endDate'] })

export const TickerItem = z.object({
  id: Id,
  text: text(3, 80, 'Ticker text'),
  href: optional(internalOrHttps),
  visible: z.boolean(),
})

export const Product = z.object({
  id: Id,
  slug: Slug,
  name: text(2, 60, 'Product name'),
  sub: text(0, 60, 'Short description'),
  price: Money.refine((n) => n > 0, 'Price must be more than $0.'),
  tag: z.enum(['NEW', 'MEMBER', 'LOW']).optional(),
  category: z.enum(['Paddles', 'Apparel', 'Gear', 'Balls']),
  description: optText(1000, 'Description'),
  options: z.array(z.object({ label: text(1, 20, 'Option name'), values: z.array(text(1, 20, 'Option value')).min(1).max(12) })).max(3).optional(),
  images: z.array(ImageRef).max(6).default([]),
  stock: z.number().int().min(0).max(100000).nullable().default(null),
  visible: z.boolean(),
})

export const MediaAsset = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/),
  file: z.string().regex(/^[a-f0-9]{24}\.(jpg|png|webp)$/),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().min(1).max(6000),
  height: z.number().int().min(1).max(6000),
  bytes: z.number().int().min(1).max(5 * 1024 * 1024),
  alt: text(0, 160, 'Image description'),
  uploadedAt: z.string(),
})

export const ALBUMS = ['Tournaments', 'Ladder', 'Clinics', 'Socials', 'Community'] as const
export const GalleryItem = z.object({
  id: Id,
  image: ImageRef,
  caption: text(3, 80, 'Caption'),
  meta: text(0, 40, 'Detail'),
  album: z.enum(ALBUMS),
  wide: z.boolean(),
  shotBy: optText(60, 'Photographer'),
  visible: z.boolean(),
})

export const CommunityPost = z.object({
  id: Id,
  slug: Slug,
  kind: z.enum(['news', 'article', 'photo-story']),
  title: text(3, 100, 'Title'),
  excerpt: text(20, 240, 'Summary'),
  body: text(0, 20000, 'Body'),
  cover: ImageRef.optional(),
  photos: z.array(ImageRef).max(40).default([]),
  author: text(2, 60, 'Author'),
  publishedAt: isoDate,
  tags: lines(text(2, 24, 'Tag')).pipe(z.array(z.string()).max(6, 'Up to 6 tags.')).default([]),
  featured: z.boolean(),
  status: z.enum(['draft', 'published']),
}).refine((p) => p.kind === 'news' || !!p.cover, { message: 'Articles and photo stories need a cover image.', path: ['cover'] })

export const Faq = z.object({ id: Id, q: text(5, 140, 'Question'), a: text(5, 600, 'Answer'), visible: z.boolean() })

/**
 * A charity the club's tournaments play for. Shown on /charity/ (anchor = slug), on the home page and on
 * the page of every tournament listed in `tournaments`. Tournaments live in the database, so they are
 * linked by web address (slug); a slug that no longer matches a visible tournament is simply not shown.
 */
export const Charity = z.object({
  id: Id,
  slug: Slug,
  name: text(2, 80, 'Charity name'),
  tagline: text(0, 120, 'Tagline'),
  /** for cards: home page and tournament pages */
  summary: text(20, 240, 'Summary'),
  /** the full story on /charity/, in the same formatting language as community posts */
  story: text(0, 10000, 'Story'),
  website: httpsUrl,
  logo: ImageRef.optional(),
  /** the charity's own flyer, shown next to the tournament's poster */
  flyer: ImageRef.optional(),
  // checked as a whole (not per item) so the error lands on the tournament picker
  tournaments: z.array(z.string()).max(20, 'Up to 20 tournaments.')
    .refine((l) => l.every((s) => Slug.safeParse(s).success), 'Pick tournaments from the list.')
    .refine((l) => new Set(l).size === l.length, 'Each tournament can only be ticked once.'),
})

export const PAGE_KEYS = ['home', 'about', 'shop', 'gallery', 'contact', 'community'] as const
export type PageKey = (typeof PAGE_KEYS)[number]
export const PageCopy = z.object({
  eyebrow: optText(40, 'Small label'),
  /** wrap one word in *stars* to colour it with the accent */
  title: text(3, 80, 'Headline'),
  lede: text(0, 300, 'Intro text'),
  heroImage: ImageRef.optional(),
  heroImageMobile: ImageRef.optional(),
})

/* the sections the MIS saves one at a time */
export const SECTIONS = {
  settings: SiteSettings,
  theme: Theme,
  ticker: z.array(TickerItem).max(20),
  products: z.array(Product).max(200).refine((l) => new Set(l.map((p) => p.slug)).size === l.length, 'Two products have the same web address.'),
  gallery: z.array(GalleryItem).max(500),
  posts: z.array(CommunityPost).max(250).refine((l) => new Set(l.map((p) => p.slug)).size === l.length, 'Two posts have the same web address.'),
  faqs: z.array(Faq).max(40),
  charities: z.array(Charity).max(20).refine((l) => new Set(l.map((c) => c.slug)).size === l.length, 'Two charities have the same web address.'),
  pages: z.object(Object.fromEntries(PAGE_KEYS.map((k) => [k, PageCopy])) as Record<PageKey, typeof PageCopy>),
} as const
export type SectionKey = keyof typeof SECTIONS

export type SiteSettingsT = z.infer<typeof SiteSettings>
export type ThemeT = z.infer<typeof Theme>
export type ClubEventT = z.infer<typeof ClubEvent>
export type TickerItemT = z.infer<typeof TickerItem>
export type ProductT = z.infer<typeof Product>
export type MediaAssetT = z.infer<typeof MediaAsset>
export type GalleryItemT = z.infer<typeof GalleryItem>
export type CommunityPostT = z.infer<typeof CommunityPost>
export type FaqT = z.infer<typeof Faq>
export type CharityT = z.infer<typeof Charity>
export type PageCopyT = z.infer<typeof PageCopy>

export type SiteContent = {
  schemaVersion: 1
  rev: number
  updatedAt: string
  settings: SiteSettingsT
  theme: ThemeT
  ticker: TickerItemT[]
  products: ProductT[]
  media: MediaAssetT[]
  gallery: GalleryItemT[]
  posts: CommunityPostT[]
  faqs: FaqT[]
  charities: CharityT[]
  pages: Record<PageKey, PageCopyT>
}

/* ---------- colour contrast (WCAG 2.x) ---------- */

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const contrastRatio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
export const CONTRAST_RULES: [fg: string, bg: string, label: string][] = [
  ['ink', 'bg', 'Text on the dark page'],
  ['ink', 'surface', 'Text on dark panels'],
  ['inkDark', 'paper', 'Text on light sections'],
  ['inkDark', 'paperCard', 'Text on light cards'],
  ['onAccent', 'accent', 'Text on accent buttons'],
  ['accent', 'bg', 'Accent text on the dark page'],
  ['danger', 'surface', 'Error text on dark'],
  ['dangerOnLight', 'paper', 'Error text on light'],
]
export function themeContrastIssues(t: Record<string, unknown>) {
  const out: { key: string; message: string; ratio: number }[] = []
  for (const [fg, bg, label] of CONTRAST_RULES) {
    const [a, b] = [t[fg], t[bg]]
    if (typeof a !== 'string' || typeof b !== 'string' || !HEX_COLOUR.test(a) || !HEX_COLOUR.test(b)) continue
    const ratio = contrastRatio(a, b)
    if (ratio < 4.5) out.push({ key: fg, ratio, message: `${label} is too faint (${ratio.toFixed(1)}:1, needs 4.5:1).` })
  }
  return out
}

/** "Everybody's welcome. *Nobody* coasts." → segments with the starred word marked */
export function accentSegments(title: string): { text: string; accent: boolean }[] {
  return title.split(/(\*[^*]+\*)/).filter(Boolean).map((part) =>
    part.startsWith('*') && part.endsWith('*') ? { text: part.slice(1, -1), accent: true } : { text: part, accent: false })
}

/**
 * JSON with object keys sorted at every level. PostgreSQL jsonb does not keep key order,
 * so comparisons and fingerprints must not depend on it. Arrays keep their order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v)
}

/** Same content regardless of object key order. */
export const sameContent = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b)

/** Fingerprint of a section as stored, so two editors never silently overwrite each other (FNV-1a). */
export function sectionHash(value: unknown): string {
  const s = canonicalJson(value)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16)
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
