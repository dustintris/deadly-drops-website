import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/content/seed'
import { Sponsor, type SponsorLevel, type SponsorT } from '../content-schema'
import {
  groupByLevel, levelAnchor, levelHeading, sponsorHref, sponsorInitials, sponsoredTournaments, sponsorsForTournament,
} from '../sponsors'

const sponsor = (id: string, level: SponsorLevel, tournaments: string[], visible = true): SponsorT => ({
  id, name: `Sponsor ${id}`, level, blurb: '', tournaments, visible,
})

describe('sponsorsForTournament', () => {
  it('finds the visible sponsors that ticked a tournament', () => {
    const list = [sponsor('aaaa', 'Gold', ['dominate-2026']), sponsor('bbbb', 'Gold', ['victory-2026']), sponsor('cccc', 'Bronze', ['victory-2026', 'dominate-2026'])]
    expect(sponsorsForTournament(list, 'dominate-2026').map((s) => s.id)).toEqual(['aaaa', 'cccc'])
  })

  it('leaves out hidden sponsors', () => {
    const list = [sponsor('aaaa', 'Title', ['dominate-2026'], false), sponsor('bbbb', 'Silver', ['dominate-2026'])]
    expect(sponsorsForTournament(list, 'dominate-2026').map((s) => s.id)).toEqual(['bbbb'])
  })

  it('puts the biggest level first and keeps the owner’s order within a level', () => {
    const list = [
      sponsor('sup1', 'Supporter', ['a-cup']), sponsor('gol1', 'Gold', ['a-cup']), sponsor('tit1', 'Title', ['a-cup']),
      sponsor('gol2', 'Gold', ['a-cup']), sponsor('sup2', 'Supporter', ['a-cup']),
    ]
    expect(sponsorsForTournament(list, 'a-cup').map((s) => s.id)).toEqual(['tit1', 'gol1', 'gol2', 'sup1', 'sup2'])
  })

  it('matches the whole web address, not part of it, and returns nothing without sponsors', () => {
    expect(sponsorsForTournament([sponsor('aaaa', 'Gold', ['dominate-2026'])], 'dominate')).toEqual([])
    expect(sponsorsForTournament([], 'dominate-2026')).toEqual([])
    expect(sponsorsForTournament(buildSeed().sponsors, 'dominate-2026')).toEqual([])
  })

  it('does not reorder the list it was given', () => {
    const list = [sponsor('sup1', 'Supporter', ['a-cup']), sponsor('tit1', 'Title', ['a-cup'])]
    sponsorsForTournament(list, 'a-cup')
    expect(list.map((s) => s.id)).toEqual(['sup1', 'tit1'])
  })
})

describe('groupByLevel', () => {
  it('groups in level order, Title first, and leaves out empty levels', () => {
    const list = [sponsor('sup1', 'Supporter', []), sponsor('bro1', 'Bronze', []), sponsor('tit1', 'Title', []), sponsor('bro2', 'Bronze', [])]
    expect(groupByLevel(list).map((g) => [g.level, g.sponsors.map((s) => s.id)])).toEqual([
      ['Title', ['tit1']],
      ['Bronze', ['bro1', 'bro2']],
      ['Supporter', ['sup1']],
    ])
  })

  it('returns no groups for no sponsors', () => {
    expect(groupByLevel([])).toEqual([])
  })
})

describe('sponsoredTournaments', () => {
  const events = [{ slug: 'dominate-2026', name: 'DOMINATE' }, { slug: 'victory-2026', name: 'VICTORY' }]

  it('lists the ticked tournaments that are on the site, in the site’s order', () => {
    expect(sponsoredTournaments({ tournaments: ['victory-2026', 'dominate-2026'] }, events).map((e) => e.name)).toEqual(['DOMINATE', 'VICTORY'])
  })

  it('skips a ticked tournament that is hidden, renamed or deleted', () => {
    expect(sponsoredTournaments({ tournaments: ['summer-slam-2027', 'victory-2026'] }, events).map((e) => e.name)).toEqual(['VICTORY'])
    expect(sponsoredTournaments({ tournaments: [] }, events)).toEqual([])
  })
})

describe('sponsor labels and links', () => {
  it('names each level’s group, singular for one', () => {
    expect(levelHeading('Title', 1)).toBe('Title sponsor')
    expect(levelHeading('Title', 2)).toBe('Title sponsors')
    expect(levelHeading('Gold', 3)).toBe('Gold sponsors')
    expect(levelHeading('Supporter', 1)).toBe('Supporter')
    expect(levelHeading('Supporter', 4)).toBe('Supporters')
  })

  it('links to the sponsor’s card and each level’s section on the Sponsors page', () => {
    expect(sponsorHref({ id: 'k2j3h4g5' })).toBe('/sponsors/#sponsor-k2j3h4g5')
    expect(levelAnchor('Gold')).toBe('sponsors-gold')
  })

  it('makes up to two initials for a sponsor without a logo', () => {
    expect(sponsorInitials('Chula Vista Brewing')).toBe('CV')
    expect(sponsorInitials('Acme')).toBe('AC')
    expect(sponsorInitials('  ')).toBe('?')
  })
})

describe('Sponsor schema', () => {
  it('accepts a sponsor the editor makes and turns an empty website into none', () => {
    const r = Sponsor.safeParse({ id: 'k2j3h4g5ab12', name: 'New sponsor', level: 'Supporter', blurb: '', website: '', tournaments: [], visible: true })
    expect(r.success).toBe(true)
    expect(r.success && r.data.website).toBeUndefined()
  })
})
