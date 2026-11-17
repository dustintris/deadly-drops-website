import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/content/seed'
import { findUsage } from '../media-usage'

const SRC = '/media/0123456789abcdef01234567.png'

describe('findUsage', () => {
  it('counts the club logo (Logo & colours), so the photo library will not delete it', () => {
    const doc = buildSeed()
    doc.theme = { ...doc.theme, logo: { src: SRC, alt: 'Club badge' } }
    expect(findUsage(SRC, doc)).toEqual(['Logo & colours: club logo'])
  })

  it('does not report an image nobody uses, or the logo once it is removed', () => {
    const doc = buildSeed()
    expect(findUsage(SRC, doc)).toEqual([])
    doc.theme = { ...doc.theme, logo: undefined }
    expect(findUsage(SRC, doc)).toEqual([])
  })

  it('still finds the other places an image is used', () => {
    const doc = buildSeed()
    doc.pages = { ...doc.pages, home: { ...doc.pages.home, heroImage: { src: SRC, alt: '' } } }
    doc.theme = { ...doc.theme, logo: { src: SRC, alt: '' } }
    expect(findUsage(SRC, doc)).toEqual(['Page: home', 'Logo & colours: club logo'])
  })
})
