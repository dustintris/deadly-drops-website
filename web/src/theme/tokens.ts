/**
 * Brand theme. Every colour on the site reads from these tokens through CSS
 * variables (see `themeToCss`), so a future admin/MIS colour setting only has
 * to supply a different `Theme` object: no component holds a literal colour.
 */
export type Theme = {
  /** page ground, darkest */
  bg: string
  /** dark panels, cards */
  surface: string
  /** raised dark panels, inputs */
  surface2: string
  /** light section ground */
  paper: string
  /** cards on light sections */
  paperCard: string
  /** main text on dark */
  ink: string
  /** text on light grounds */
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

/** The site's colours until an admin picks others in Logo & colours: Blossom. */
export const defaultTheme: Theme = BLOSSOM_THEME

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

const hexToRgb = (hex: string): string => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** The colour keys, in a fixed order. The saved theme also holds the logo, which is not a colour. */
const COLOUR_KEYS = Object.keys(defaultTheme) as (keyof Theme)[]

/** Renders the theme's colours as CSS custom properties. `-rgb` variants allow alpha: rgb(var(--accent-rgb) / .3) */
export function themeToCss(theme: Theme): string {
  const lines = COLOUR_KEYS.flatMap((key) => {
    // a theme saved before a colour existed gets that colour's default
    const value = theme[key] || defaultTheme[key]
    const name = key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    return [`--${name}: ${value};`, `--${name}-rgb: ${hexToRgb(value)};`]
  })
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
