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

  it('counts a charity’s logo and flyer, so neither can be deleted while the charity shows it', () => {
    const doc = buildSeed()
    const [first, second] = doc.charities
    doc.charities = [{ ...first, logo: { src: SRC, alt: 'Us4Warriors logo' } }, second]
    expect(findUsage(SRC, doc)).toEqual(['Charity: Us4Warriors'])

    doc.charities = [first, { ...second, flyer: { src: SRC, alt: 'Breast Cancer Angels flyer' } }]
    expect(findUsage(SRC, doc)).toEqual(['Charity: Breast Cancer Angels'])

    doc.charities = [first, second]
    expect(findUsage(SRC, doc)).toEqual([])
  })

  it('counts a volunteer’s photo, so it can’t be deleted while they are on the Volunteers page', () => {
    const doc = buildSeed()
    const person = { id: 'vol-maria', name: 'Maria G.', role: 'Check-in desk', bio: '', visible: true }
    doc.volunteers = { ...doc.volunteers, people: [{ ...person, photo: { src: SRC, alt: '' } }] }
    expect(findUsage(SRC, doc)).toEqual(['Volunteer: Maria G.'])
    doc.volunteers = { ...doc.volunteers, people: [person] }
    expect(findUsage(SRC, doc)).toEqual([])
  })

  it('still finds the other places an image is used', () => {
    const doc = buildSeed()
    doc.pages = { ...doc.pages, home: { ...doc.pages.home, heroImage: { src: SRC, alt: '' } } }
    doc.theme = { ...doc.theme, logo: { src: SRC, alt: '' } }
    expect(findUsage(SRC, doc)).toEqual(['Page: home', 'Logo & colours: club logo'])
  })
})
