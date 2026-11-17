import { describe, expect, it } from 'vitest'
import { Theme, THEME_COLOUR_KEYS, themeContrastIssues } from '@/lib/content-schema'
import { DEFAULT_LOGO, defaultTheme, LEGACY_LIME_THEME, themeLogo, themeToCss } from '../tokens'

const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Deadly Drops oni badge' }

describe('themeToCss', () => {
  it('writes every colour as a CSS variable with an -rgb twin', () => {
    const css = themeToCss(defaultTheme)
    expect(css).toContain('--bg: #120A2E;')
    expect(css).toContain('--bg-rgb: 18 10 46;')
    expect(css).toContain('--accent: #FF5CB8;')
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

describe('default and legacy palettes', () => {
  it('passes every readability check the theme editor enforces (WCAG AA 4.5:1)', () => {
    expect(themeContrastIssues(defaultTheme)).toEqual([])
    expect(themeContrastIssues(LEGACY_LIME_THEME)).toEqual([])
    expect(Theme.safeParse({ ...defaultTheme }).success).toBe(true)
  })

  it('both define exactly the colours the saved theme holds', () => {
    expect(Object.keys(defaultTheme).sort()).toEqual([...THEME_COLOUR_KEYS].sort())
    expect(Object.keys(LEGACY_LIME_THEME).sort()).toEqual([...THEME_COLOUR_KEYS].sort())
  })

  it('keeps the original lime design as the legacy palette', () => {
    expect(LEGACY_LIME_THEME).toMatchObject({ bg: '#080808', accent: '#C6F24E', paper: '#F2F2EE', onAccent: '#111111' })
    expect(defaultTheme.accent).not.toBe(LEGACY_LIME_THEME.accent)
  })
})
