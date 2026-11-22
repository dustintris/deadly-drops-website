import { describe, expect, it } from 'vitest'
import { Theme, THEME_COLOUR_KEYS, themeContrastIssues } from '@/lib/content-schema'
import { contrastRatio, readableOn } from '../colour'
import { BLOOM_THEME, BLOSSOM_BRIGHT_THEME, BLOSSOM_THEME, DEFAULT_LOGO, defaultTheme, LEGACY_LIME_THEME, themeDerived, themeGround, themeLogo, themeToCss, TWILIGHT_THEME } from '../tokens'

const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Deadly Drops oni badge' }
const NIGHT = { 'Blossom bright': BLOSSOM_BRIGHT_THEME, Blossom: BLOSSOM_THEME, Twilight: TWILIGHT_THEME, Lime: LEGACY_LIME_THEME }
const PALETTES = { Bloom: BLOOM_THEME, ...NIGHT }

describe('themeToCss', () => {
  it('writes every colour as a CSS variable with an -rgb twin', () => {
    const css = themeToCss(defaultTheme)
    expect(css).toContain('--bg: #F7E4EA;')
    expect(css).toContain('--bg-rgb: 247 228 234;')
    expect(css).toContain('--accent: #FF77B7;')
    expect(css).toContain('--danger-on-light-rgb: 161 29 29;')
    expect(css).toContain('--logo-plate: #FFFFFF;')
  })

  it('also writes the colours derived from the palette, with -rgb twins', () => {
    const css = themeToCss(BLOOM_THEME)
    const d = themeDerived(BLOOM_THEME)
    expect(css).toContain(`--accent-ink: ${d.accentInk};`)
    expect(css).toContain(`--accent-soft-ink: ${d.accentSoftInk};`)
    expect(css).toContain('--on-ink-dark: #F0FFF0;')
    expect(css).toContain('--on-ink-dark-rgb: 240 255 240;')
    expect(css).toContain('--twinkle: #A95BC8;')
  })

  it('fills a colour saved before it existed from the default, and derives from the filled palette', () => {
    const { logoPlate: _missing, ...older } = BLOSSOM_BRIGHT_THEME
    const css = themeToCss(older as typeof BLOSSOM_BRIGHT_THEME)
    expect(css).toContain('--logo-plate: #FFFFFF;')
    expect(css).toContain('--accent-ink: #ED7BAB;')
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

  it('defaults to Bloom: the owner’s pastel palette on a light blush page, with near-black text', () => {
    expect(defaultTheme).toEqual(BLOOM_THEME)
    expect(BLOOM_THEME).toMatchObject({
      bg: '#F7E4EA', surface: '#F5D3DD', paper: '#F3C1D0', // blush
      surface2: '#F0FFF0', paperCard: '#F0FFF0', // honeydew cards
      accent: '#FF77B7', accentDeep: '#A95BC8', accentSoft: '#E1B7E3', accentTint: '#D0E8D0', // pink, purple, lavender, sage
      ink: '#0D111A', inkDark: '#0D111A', onAccent: '#0D111A',
    })
  })

  it('keeps Blossom with the brighter plum grounds as a preset', () => {
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
    expect(new Set(Object.values(NIGHT).map((p) => p.accent)).size).toBe(3)
  })
})

describe('themeDerived', () => {
  it.each(Object.entries(NIGHT))('%s: every derived colour is one the palette already has, so the night designs look as before', (_name, p) => {
    expect(themeDerived(p)).toEqual({ accentInk: p.accent, accentSoftInk: p.accentSoft, onInkDark: p.ink, twinkle: p.ink })
  })

  it('Bloom: accent words in deeper shades of the pink and lavender, readable on the page, bands, cards and walls', () => {
    const d = themeDerived(BLOOM_THEME)
    expect(d.accentInk).toBe('#AF0052')
    expect(d.accentSoftInk).toBe('#87368B')
    for (const ground of [BLOOM_THEME.bg, BLOOM_THEME.surface, BLOOM_THEME.surface2, BLOOM_THEME.paper]) {
      expect(contrastRatio(d.accentInk, ground)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(d.accentSoftInk, ground)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('Bloom: light text on the black tiles (the page text is near-black too), and purple star dust', () => {
    const d = themeDerived(BLOOM_THEME)
    expect(d.onInkDark).toBe(BLOOM_THEME.paperCard)
    expect(contrastRatio(d.onInkDark, BLOOM_THEME.inkDark)).toBeGreaterThanOrEqual(4.5)
    expect(d.twinkle).toBe(BLOOM_THEME.accentDeep)
  })
})

describe('themeGround', () => {
  it('calls Bloom a light page and every other preset a night one', () => {
    expect(themeGround(BLOOM_THEME)).toBe('light')
    for (const p of Object.values(NIGHT)) expect(themeGround(p)).toBe('night')
  })

  it('falls back to the default colours for a theme saved without them', () => {
    expect(themeGround({ bg: '', ink: '' })).toBe(themeGround(defaultTheme))
  })
})

describe('readableOn', () => {
  it('keeps a colour that already reads on the page', () => {
    expect(readableOn('#ED7BAB', ['#1C1830'], '#F9F9F9')).toBe('#ED7BAB')
  })

  it('deepens a light colour on a light page, and lightens a dark one on a night page, keeping its hue', () => {
    const deep = readableOn('#FF77B7', ['#FFFFFF'], '#000000')
    expect(contrastRatio(deep, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(deep).toMatch(/^#[A-F0-9]{6}$/)
    const light = readableOn('#7A1040', ['#0D111A'], '#FFFFFF')
    expect(contrastRatio(light, '#0D111A')).toBeGreaterThanOrEqual(4.5)
  })

  it('falls back to the text colour when no shade of the hue can read on every ground', () => {
    // a mid grey ground: no shade of yellow reaches 4.5:1 on both it and black
    expect(readableOn('#FFFF00', ['#777777', '#000000'], '#000000')).toBe('#000000')
  })
})
