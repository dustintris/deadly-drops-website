import { describe, expect, it } from 'vitest'
import { Theme, THEME_COLOUR_KEYS, themeContrastIssues } from '@/lib/content-schema'
import { BLOSSOM_BRIGHT_THEME, BLOSSOM_THEME, DEFAULT_LOGO, defaultTheme, LEGACY_LIME_THEME, themeLogo, themeToCss, TWILIGHT_THEME } from '../tokens'

const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Deadly Drops oni badge' }
const PALETTES = { 'Blossom bright': BLOSSOM_BRIGHT_THEME, Blossom: BLOSSOM_THEME, Twilight: TWILIGHT_THEME, Lime: LEGACY_LIME_THEME }

describe('themeToCss', () => {
  it('writes every colour as a CSS variable with an -rgb twin', () => {
    const css = themeToCss(defaultTheme)
    expect(css).toContain('--bg: #1C1830;')
    expect(css).toContain('--bg-rgb: 28 24 48;')
    expect(css).toContain('--accent: #ED7BAB;')
    expect(css).toContain('--danger-on-light-rgb: 161 29 29;')
    expect(css).toContain('--logo-plate: #FFFFFF;')
  })

  it('skips the logo: it is an image, not a colour', () => {
    const saved = Theme.parse({ ...defaultTheme, logo: LOGO }) // what the root layout gets from the store
    const css = themeToCss(saved)
    expect(css).toBe(themeToCss(defaultTheme))
    expect(css).not.toContain('--logo:')
    expect(css).not.toContain('object')
  })
})

describe('themeLogo', () => {
  it('falls back to the bundled club badge until a logo is uploaded', () => {
    expect(themeLogo(Theme.parse({ ...defaultTheme }))).toEqual({ src: '/logo.png', alt: DEFAULT_LOGO.alt }) // saved before logos existed
    expect(themeLogo({ logo: undefined }).src).toBe('/logo.png')
    expect(themeLogo({ logo: { src: '', alt: '' } }).src).toBe('/logo.png')
  })

  it('uses the uploaded logo and its description', () => {
    expect(themeLogo({ logo: LOGO })).toEqual(LOGO)
  })

  it('gives an uploaded logo without a description a plain one, so the footer image is never unnamed', () => {
    expect(themeLogo({ logo: { src: LOGO.src, alt: '' } })).toEqual({ src: LOGO.src, alt: 'Deadly Drops Pickleball logo' })
  })
})

describe('default and preset palettes', () => {
  it.each(Object.entries(PALETTES))('%s passes every readability check the theme editor enforces (WCAG AA 4.5:1)', (_name, palette) => {
    expect(themeContrastIssues(palette)).toEqual([])
    expect(Theme.safeParse({ ...palette }).success).toBe(true)
  })

  it.each(Object.entries(PALETTES))('%s defines exactly the colours the saved theme holds', (_name, palette) => {
    expect(Object.keys(palette).sort()).toEqual([...THEME_COLOUR_KEYS].sort())
  })

  it('defaults to Blossom with the brighter plum grounds, everything else unchanged', () => {
    expect(defaultTheme).toEqual(BLOSSOM_BRIGHT_THEME)
    expect(BLOSSOM_BRIGHT_THEME).toEqual({ ...BLOSSOM_THEME, bg: '#1C1830', surface: '#2A2443', surface2: '#372F55', accentTint: '#4A2142' })
  })

  it('keeps the original Blossom, built from the club owner’s palette, as a preset', () => {
    expect(BLOSSOM_THEME).toMatchObject({
      bg: '#0D111A', inkDark: '#0D111A', onAccent: '#0D111A', // navy-black
      ink: '#F9F9F9', paperCard: '#F9F9F9', // off-white
      paper: '#F5D3DD', accentSoft: '#F5D3DD', // blush
      accent: '#ED7BAB', // pink: the accent text on the navy page
      accentDeep: '#E42278', // magenta: gradients and glows only (under 4.5:1 on the navy)
    })
  })

  it('keeps Twilight and the original lime design as presets', () => {
    expect(TWILIGHT_THEME).toMatchObject({ bg: '#120A2E', accent: '#FF5CB8', paper: '#FDE8F3', onAccent: '#1A0D22' })
    expect(LEGACY_LIME_THEME).toMatchObject({ bg: '#080808', accent: '#C6F24E', paper: '#F2F2EE', onAccent: '#111111' })
    expect(new Set(Object.values(PALETTES).map((p) => p.accent)).size).toBe(3)
  })
})
