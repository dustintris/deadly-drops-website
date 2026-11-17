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
 * "Twilight": a deep indigo night sky fading to orchid, neon pink and lilac highlights, blush-pink light
 * sections and near-black accents. Every text pair the admin checks is WCAG AA (see `themeContrastIssues`).
 */
export const defaultTheme: Theme = {
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
