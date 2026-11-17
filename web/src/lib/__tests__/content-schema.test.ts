import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/content/seed'
import { defaultTheme } from '@/theme/tokens'
import { Charity, SECTIONS, sameContent, sectionHash, Theme, type CharityT } from '../content-schema'

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

describe('Charity (Admin → Charities)', () => {
  const good: CharityT = {
    id: 'charity-test',
    slug: 'us4warriors',
    name: 'Us4Warriors',
    tagline: 'Standing Together for Those Who Serve',
    summary: 'A volunteer-based nonprofit helping military families in San Diego County.',
    story: 'First paragraph.\n\nSecond paragraph with a [link](https://www.us4warriors.org).',
    website: 'https://www.us4warriors.org',
    tournaments: ['dominate-2026'],
  }
  const paths = (v: unknown) => {
    const r = Charity.safeParse(v)
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
  }

  it('accepts a complete charity, with or without a logo and flyer', () => {
    expect(paths(good)).toEqual([])
    const img = { src: '/media/0123456789abcdef01234567.jpg', alt: 'Flyer' }
    expect(paths({ ...good, logo: img, flyer: img })).toEqual([])
  })

  it('needs an https website', () => {
    expect(paths({ ...good, website: 'http://us4warriors.org' })).toEqual(['website'])
    expect(paths({ ...good, website: 'javascript:alert(1)' })).toEqual(['website'])
    expect(paths({ ...good, website: '' })).toEqual(['website'])
    expect(paths({ ...good, website: 'https://' })).toEqual(['website'])
    // looks like the charity's site, opens another
    expect(paths({ ...good, website: 'https://us4warriors.org@elsewhere.example' })).toEqual(['website'])
    expect(paths({ ...good, website: 'https://user:pass@us4warriors.org' })).toEqual(['website'])
  })

  it('needs a web-address-safe slug (it becomes the anchor on /charity/)', () => {
    expect(paths({ ...good, slug: 'Us 4 Warriors' })).toEqual(['slug'])
    expect(paths({ ...good, slug: 'us4warriors-' })).toEqual(['slug'])
    expect(paths({ ...good, slug: 'breast-cancer-angels' })).toEqual([])
  })

  it('takes tournaments by web address, each once, and may have none', () => {
    expect(paths({ ...good, tournaments: [] })).toEqual([])
    expect(paths({ ...good, tournaments: ['dominate-2026', 'victory-dink-for-pink-2026'] })).toEqual([])
    expect(paths({ ...good, tournaments: ['DOMINATE 2026'] })).toEqual(['tournaments'])
    expect(paths({ ...good, tournaments: ['dominate-2026', 'dominate-2026'] })).toEqual(['tournaments'])
    expect(paths({ ...good, tournaments: 'dominate-2026' })).toEqual(['tournaments'])
  })

  it('keeps the card summary short and only takes images from the media library', () => {
    expect(paths({ ...good, summary: 'x'.repeat(241) })).toEqual(['summary'])
    expect(paths({ ...good, summary: 'Too short' })).toEqual(['summary'])
    expect(paths({ ...good, flyer: { src: 'https://example.com/flyer.jpg', alt: '' } })).toEqual(['flyer.src'])
  })

  it('refuses two charities with the same web address', () => {
    const r = SECTIONS.charities.safeParse([good, { ...good, id: 'charity-two', name: 'Copy' }])
    expect(r.success).toBe(false)
    expect(SECTIONS.charities.safeParse([good, { ...good, id: 'charity-two', slug: 'other' }]).success).toBe(true)
  })

  it('seeds Us4Warriors (DOMINATE) and Breast Cancer Angels (VICTORY), valid as the admin would save them', () => {
    const seed = buildSeed().charities
    const r = SECTIONS.charities.safeParse(seed)
    expect(r.success && r.data).toEqual(seed)
    expect(seed.map((c) => [c.slug, c.tournaments])).toEqual([
      ['us4warriors', ['dominate-2026']],
      ['breast-cancer-angels', ['victory-dink-for-pink-2026']],
    ])
    // the charity's own story, as three paragraphs, then the sign-off
    const paragraphs = seed[0].story.split('\n\n')
    expect(paragraphs).toHaveLength(4)
    expect(paragraphs.at(-1)).toBe('— Danny Shaffsta')
  })
})
