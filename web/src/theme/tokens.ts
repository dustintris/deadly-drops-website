import { contrastRatio, hexToRgb, luminance, READABLE, readableOn } from './colour'

/**
 * Brand theme. Every colour on the site reads from these tokens through CSS
 * variables (see `themeToCss`), so a future admin/MIS colour setting only has
 * to supply a different `Theme` object: no component holds a literal colour.
 * A palette can sit on a night ground (Blossom, Twilight, Lime) or a light one (Bloom): the colours the site
 * derives from it (`themeDerived`) keep accent text and the black tiles readable either way.
 */
export type Theme = {
  /** page ground (a night sky, or a light blush) */
  bg: string
  /** panels, alternate bands */
  surface: string
  /** cards, inputs */
  surface2: string
  /** light section ground */
  paper: string
  /** cards on light sections */
  paperCard: string
  /** main text on the page and panels */
  ink: string
  /** text on light grounds, and the black tiles */
  inkDark: string
  /** brand accent */
  accent: string
  /** lighter accent for hovers and secondary highlights */
  accentSoft: string
  /** deeper accent for gradients */
  accentDeep: string
  /** text placed on the accent */
  onAccent: string
  /** dark tint used behind monogram tiles */
  accentTint: string
  /** error text on dark grounds */
  danger: string
  /** error text on light grounds */
  dangerOnLight: string
  /** plate behind the crest logo (the artwork has a white ground) */
  logoPlate: string
}

/**
 * "Blossom", the club owner's palette: a navy-black night (#0D111A) with plum-tinted panels, pink
 * (#ED7BAB) for accent text and buttons, magenta (#E42278) for gradients and glows only (it is under
 * 4.5:1 on the navy, so it never carries text there), blush (#F5D3DD) light sections with off-white
 * (#F9F9F9) cards and text. Every text pair the admin checks is WCAG AA (see `themeContrastIssues`).
 */
export const BLOSSOM_THEME: Theme = {
  bg: '#0D111A',
  surface: '#1A1828',
  surface2: '#262036',
  paper: '#F5D3DD',
  paperCard: '#F9F9F9',
  ink: '#F9F9F9',
  inkDark: '#0D111A',
  accent: '#ED7BAB',
  accentSoft: '#F5D3DD',
  accentDeep: '#E42278',
  onAccent: '#0D111A',
  accentTint: '#3A1830',
  danger: '#FFA680',
  dangerOnLight: '#A11D1D',
  // the crest artwork has a pure white ground, so its plate stays white rather than the off-white
  logoPlate: '#FFFFFF',
}

/**
 * "Blossom", brighter: the same pink, blush and off-white over a lifted plum night instead of the navy-black
 * (the owner asked for a brighter background in the same colours). Only the dark grounds change: the page
 * (#1C1830), panels (#2A2443, #372F55) and the accent tint. Migration `drizzle/0014_blossom_bright.sql` moved
 * content saved with the exact Blossom colours here once (its test checks both palettes there match this
 * file). Every text pair the admin checks is WCAG AA.
 */
export const BLOSSOM_BRIGHT_THEME: Theme = {
  ...BLOSSOM_THEME,
  bg: '#1C1830',
  surface: '#2A2443',
  surface2: '#372F55',
  accentTint: '#4A2142',
}

/**
 * "Bloom", from the palette the owner picked for the Beauty in the Beast season ("Softly Fading Harmonious Bloom":
 * #FF77B7 #A95BC8 #A5E1A0 #F3C1D0 #E1B7E3 #D0E8D0 #FFCEFF #F0FFF0): a light blush page (#F7E4EA, the blush of the
 * light sections' glossy top) with blush bands (#F5D3DD) and walls (#F3C1D0), honeydew cards and inputs (#F0FFF0),
 * the pink (#FF77B7) for buttons, chips, glows and cloud rims, purple (#A95BC8) for gradients and the walls' accent
 * words, lavender (#E1B7E3) for hovers, sage (#D0E8D0) as the tint, and near-black text and tiles. The pink and
 * lavender are too light to be text on the blush, so the site writes accent words in deeper shades of them
 * (`themeDerived`: #AF0052 and #87368B). Migration `drizzle/0015_bloom_theme.sql` moved content saved with the
 * Blossom-bright colours here once (its test checks both palettes there match this file). Every text pair the admin
 * checks is WCAG AA.
 */
export const BLOOM_THEME: Theme = {
  bg: '#F7E4EA',
  surface: '#F5D3DD',
  surface2: '#F0FFF0',
  paper: '#F3C1D0',
  paperCard: '#F0FFF0',
  ink: '#0D111A',
  inkDark: '#0D111A',
  accent: '#FF77B7',
  accentSoft: '#E1B7E3',
  accentDeep: '#A95BC8',
  onAccent: '#0D111A',
  accentTint: '#D0E8D0',
  danger: '#A11D1D',
  dangerOnLight: '#A11D1D',
  logoPlate: '#FFFFFF',
}

/** The site's colours until an admin picks others in Logo & colours: Bloom. */
export const defaultTheme: Theme = BLOOM_THEME

/**
 * "Twilight": a deep indigo night sky fading to orchid, neon pink and lilac highlights, blush-pink light
 * sections and near-black accents. The default until Blossom; kept as an admin preset. Migration
 * `drizzle/0012_blossom_theme.sql` moved content saved with these exact colours to Blossom once (its test
 * checks both palettes there match this file). Every text pair the admin checks is WCAG AA.
 */
export const TWILIGHT_THEME: Theme = {
  bg: '#120A2E',
  surface: '#1C1142',
  surface2: '#281A57',
  paper: '#FDE8F3',
  paperCard: '#FFFFFF',
  ink: '#FFF4FB',
  inkDark: '#1A0D22',
  accent: '#FF5CB8',
  accentSoft: '#D9C2FF',
  accentDeep: '#A8247E',
  onAccent: '#1A0D22',
  accentTint: '#2E1440',
  danger: '#FF9F85',
  dangerOnLight: '#B3261E',
  logoPlate: '#FFFFFF',
}

/**
 * The site's first palette (dark with lime), the default until the Twilight redesign. Kept as an admin
 * preset; migration `drizzle/0005_twilight_theme.sql` moved content saved with these exact colours to
 * Twilight once (its test checks both palettes there match this file).
 */
export const LEGACY_LIME_THEME: Theme = {
  bg: '#080808',
  surface: '#111111',
  surface2: '#181818',
  paper: '#F2F2EE',
  paperCard: '#FFFFFF',
  ink: '#F4F4F2',
  inkDark: '#111111',
  accent: '#C6F24E',
  accentSoft: '#E4FBA6',
  accentDeep: '#8FC21F',
  onAccent: '#111111',
  accentTint: '#1F2418',
  danger: '#FF8F8F',
  dangerOnLight: '#B3261E',
  logoPlate: '#FFFFFF',
}

/** The colour keys, in a fixed order. The saved theme also holds the logo, which is not a colour. */
const COLOUR_KEYS = Object.keys(defaultTheme) as (keyof Theme)[]

/**
 * Colours the site works out from a palette, so any palette reads on a night ground or a light one. On the night
 * presets every one equals a colour the palette already has, so they look exactly as before:
 * - accentInk / accentSoftInk: the accent (and its lighter twin) as text on the page, panels and cards; the colour
 *   itself when it reads on the page, else a deeper shade of the same hue (see `readableOn`). Fills, borders and
 *   glows keep the accent itself.
 * - onInkDark: text on the black tiles and buttons (an inkDark ground); the page text when it reads there (a night
 *   palette's off-white), else the light cards' colour (the admin checks that pair).
 * - twinkle: the brightest star dust; the page text on a night sky, the deep accent on a light ground.
 */
export function themeDerived(t: Theme) {
  const light = themeGround(t) === 'light'
  // on a light page accent words can also sit on the light sections' walls; on a night page those keep their own
  // deep pink (`.light .accent`), and a pastel wall would make a light accent impossible to place
  const grounds = light ? [t.bg, t.surface, t.surface2, t.paper] : [t.bg, t.surface, t.surface2]
  return {
    accentInk: readableOn(t.accent, grounds, t.ink),
    accentSoftInk: readableOn(t.accentSoft, grounds, t.ink),
    onInkDark: contrastRatio(t.ink, t.inkDark) >= READABLE ? t.ink : t.paperCard,
    twinkle: light ? t.accentDeep : t.ink,
  }
}

/** A theme saved before a colour existed gets that colour's default. */
const resolve = (theme: Theme): Theme => Object.fromEntries(COLOUR_KEYS.map((key) => [key, theme[key] || defaultTheme[key]])) as Theme

/**
 * "light" when the page is lighter than its text (Bloom), "night" otherwise. The root layout puts it on <html> as
 * data-ground, for the few rules a light page needs (firmer form and chip outlines) that would change a night design.
 */
export function themeGround(theme: Pick<Theme, 'bg' | 'ink'>): 'light' | 'night' {
  const bg = theme.bg || defaultTheme.bg
  const ink = theme.ink || defaultTheme.ink
  return luminance(bg) > luminance(ink) ? 'light' : 'night'
}

const cssName = (key: string) => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/**
 * Renders the theme's colours, and the ones derived from them, as CSS custom properties.
 * `-rgb` variants allow alpha: rgb(var(--accent-rgb) / .3)
 */
export function themeToCss(theme: Theme): string {
  const full = resolve(theme)
  const all: [string, string][] = [...COLOUR_KEYS.map((key): [string, string] => [key, full[key]]), ...Object.entries(themeDerived(full))]
  const lines = all.flatMap(([key, value]) => [`--${cssName(key)}: ${value};`, `--${cssName(key)}-rgb: ${hexToRgb(value)};`])
  return `:root{${lines.join('')}}`
}

/** The club badge that ships with the site (public/logo.png): the logo until one is uploaded in Admin → Logo & colours. */
export const DEFAULT_LOGO = { src: '/logo.png', alt: 'Deadly Drops Pickleball crest' } as const

/** The club logo to show for a saved theme: the uploaded one, else the bundled badge. */
export function themeLogo(theme: { logo?: { src: string; alt: string } }): { src: string; alt: string } {
  const logo = theme.logo
  if (!logo?.src) return { ...DEFAULT_LOGO }
  // the badge's own description would be wrong for a new picture, so an undescribed upload gets a plain name
  return { src: logo.src, alt: logo.alt || 'Deadly Drops Pickleball logo' }
}
