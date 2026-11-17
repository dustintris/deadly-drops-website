import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/content/seed'
import { charitiesForTournament, charityHref, websiteLabel } from '../charities'
import type { CharityT } from '../content-schema'

const charity = (slug: string, tournaments: string[]): CharityT => ({
  id: `charity-${slug}`, slug, name: slug, tagline: '', summary: 'Helps people in our community every day.', story: '',
  website: `https://${slug}.org`, tournaments,
})

describe('charitiesForTournament', () => {
  it('finds the charity a tournament plays for (seed: DOMINATE → Us4Warriors, VICTORY → Breast Cancer Angels)', () => {
    const seed = buildSeed().charities
    expect(charitiesForTournament(seed, 'dominate-2026').map((c) => c.name)).toEqual(['Us4Warriors'])
    expect(charitiesForTournament(seed, 'victory-dink-for-pink-2026').map((c) => c.name)).toEqual(['Breast Cancer Angels'])
  })

  it('returns nothing for a tournament no charity lists, or with no charities at all', () => {
    expect(charitiesForTournament(buildSeed().charities, 'summer-slam-2027')).toEqual([])
    expect(charitiesForTournament([], 'dominate-2026')).toEqual([])
  })

  it('returns every charity a tournament plays for, in the admin order', () => {
    const list = [charity('first', ['a-cup']), charity('other', ['b-cup']), charity('second', ['b-cup', 'a-cup'])]
    expect(charitiesForTournament(list, 'a-cup').map((c) => c.slug)).toEqual(['first', 'second'])
  })

  it('matches the whole web address, not part of it', () => {
    expect(charitiesForTournament([charity('x', ['dominate-2026'])], 'dominate')).toEqual([])
  })
})

describe('charity links', () => {
  it('points at the charity section of the Charity page', () => {
    expect(charityHref({ slug: 'us4warriors' })).toBe('/charity/#charity-us4warriors')
  })

  it('names the website in the charity’s own capitals when the address is its name', () => {
    expect(websiteLabel('https://www.us4warriors.org', 'Us4Warriors')).toBe('Us4Warriors.org')
    expect(websiteLabel('https://www.breastcancerangels.org', 'Breast Cancer Angels')).toBe('BreastCancerAngels.org')
  })

  it('falls back to the bare host name otherwise', () => {
    expect(websiteLabel('https://www.example.org/give', 'Helping Hands')).toBe('example.org')
    expect(websiteLabel('https://donate.example.org', 'Example')).toBe('donate.example.org')
  })
})
