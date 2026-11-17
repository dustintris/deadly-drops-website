import { describe, expect, it } from 'vitest'
import { defaultTheme } from '@/theme/tokens'
import { sameContent, sectionHash, Theme } from '../content-schema'

const LOGO = { src: '/media/0123456789abcdef01234567.png', alt: 'Deadly Drops oni badge' }
const issuePaths = (r: ReturnType<typeof Theme.safeParse>) => (r.success ? [] : r.error.issues.map((i) => i.path.join('.')))

describe('Theme (Admin → Logo & colours)', () => {
  it('still accepts a theme saved before the logo existed (colours only)', () => {
    const r = Theme.safeParse({ ...defaultTheme })
    expect(r.success).toBe(true)
    expect(r.success && r.data.logo).toBeUndefined()
  })

  it('accepts and keeps an uploaded logo next to the colours', () => {
    const r = Theme.safeParse({ ...defaultTheme, logo: LOGO })
    expect(issuePaths(r)).toEqual([])
    expect(r.success && r.data.logo).toEqual(LOGO)
  })

  it('does not treat the logo as a colour: no "Use a colour like…" error for it', () => {
    const r = Theme.safeParse({ ...defaultTheme, logo: LOGO, accent: 'lime' })
    expect(issuePaths(r)).toEqual(['accent'])
  })

  it('only takes a logo from the media library', () => {
    expect(issuePaths(Theme.safeParse({ ...defaultTheme, logo: { src: 'https://example.com/x.png', alt: '' } }))).toEqual(['logo.src'])
    expect(issuePaths(Theme.safeParse({ ...defaultTheme, logo: { src: '/logo.png', alt: '' } }))).toEqual([])
  })
})

describe('sectionHash / sameContent', () => {
  it('ignores object key order (PostgreSQL jsonb reorders keys)', () => {
    const a = { name: 'Deadly Drops', city: 'Chula Vista', nested: { b: 1, a: [{ y: 2, x: 1 }] } }
    const b = { nested: { a: [{ x: 1, y: 2 }], b: 1 }, city: 'Chula Vista', name: 'Deadly Drops' }
    expect(sectionHash(a)).toBe(sectionHash(b))
    expect(sameContent(a, b)).toBe(true)
  })

  it('still notices real changes, including array order', () => {
    expect(sectionHash({ a: 1 })).not.toBe(sectionHash({ a: 2 }))
    expect(sameContent([1, 2], [2, 1])).toBe(false)
    expect(sameContent({ a: 1 }, { a: 1, b: undefined })).toBe(true) // undefined keys are dropped, as in JSON
  })
})
