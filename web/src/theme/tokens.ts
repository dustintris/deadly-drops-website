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

export const defaultTheme: Theme = {
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

/** Renders the theme as CSS custom properties. `-rgb` variants allow alpha: rgb(var(--accent-rgb) / .3) */
export function themeToCss(theme: Theme): string {
  const lines = Object.entries(theme).flatMap(([key, value]) => {
    const name = key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    return [`--${name}: ${value};`, `--${name}-rgb: ${hexToRgb(value)};`]
  })
  return `:root{${lines.join('')}}`
}
