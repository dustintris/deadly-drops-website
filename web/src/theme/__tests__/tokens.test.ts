import { describe, expect, it } from 'vitest'
import { Theme } from '@/lib/content-schema'
import { DEFAULT_LOGO, defaultTheme, themeLogo, themeToCss } from '../tokens'

const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Deadly Drops oni badge' }

describe('themeToCss', () => {
  it('writes every colour as a CSS variable with an -rgb twin', () => {
    const css = themeToCss(defaultTheme)
    expect(css).toContain('--bg: #080808;')
    expect(css).toContain('--bg-rgb: 8 8 8;')
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
