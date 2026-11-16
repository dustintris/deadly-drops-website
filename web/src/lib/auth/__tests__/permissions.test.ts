import { describe, expect, it } from 'vitest'
import { SECTIONS } from '@/lib/content-schema'
import { AREAS, can, editableSections, normalizePerms, PRESETS, presetOf, SECTION_AREA, withinCeiling, type Perms } from '../permissions'

const perms = (p: Partial<Perms>): Perms => normalizePerms(p)
const staff = (p: Partial<Perms>) => ({ isOwner: false, perms: perms(p) })

describe('can()', () => {
  it('lets the owner do everything, whatever is stored', () => {
    const owner = { isOwner: true, perms: perms({}) }
    for (const a of AREAS) expect(can(owner, a, 'edit')).toBe(true)
  })

  it('treats edit as including view, and none as nothing', () => {
    const s = staff({ content: 'edit', shop: 'view' })
    expect(can(s, 'content', 'view')).toBe(true)
    expect(can(s, 'content', 'edit')).toBe(true)
    expect(can(s, 'shop', 'view')).toBe(true)
    expect(can(s, 'shop', 'edit')).toBe(false)
    expect(can(s, 'staff', 'view')).toBe(false)
  })

  it('refuses a missing session', () => {
    expect(can(null, 'content', 'view')).toBe(false)
  })
})

describe('normalizePerms()', () => {
  it('fills every area and drops unknown areas or levels', () => {
    const p = normalizePerms({ content: 'edit', shop: 'admin', bogus: 'edit' })
    expect(Object.keys(p).sort()).toEqual([...AREAS].sort())
    expect(p.content).toBe('edit')
    expect(p.shop).toBe('none')
    expect((p as Record<string, string>).bogus).toBeUndefined()
  })
})

describe('presets', () => {
  it('gives a scorekeeper scoring only, plus a view of tournaments', () => {
    const s = { isOwner: false, perms: PRESETS.find((x) => x.key === 'scorekeeper')!.perms }
    expect(can(s, 'scoring', 'edit')).toBe(true)
    expect(can(s, 'tournaments', 'view')).toBe(true)
    expect(can(s, 'tournaments', 'edit')).toBe(false)
    expect(can(s, 'content', 'view')).toBe(false)
    expect(can(s, 'staff', 'view')).toBe(false)
  })

  it('recognises a preset from its permissions, otherwise custom', () => {
    for (const p of PRESETS) expect(presetOf(p.perms)).toBe(p.key)
    expect(presetOf(perms({ shop: 'edit', scoring: 'view' }))).toBe('custom')
  })

  it('never hands out staff management through a preset', () => {
    for (const p of PRESETS) expect(p.perms.staff).toBe('none')
  })
})

describe('withinCeiling()', () => {
  it('lets the owner hand out anything', () => {
    expect(withinCeiling({ isOwner: true, perms: perms({}) }, perms({ staff: 'edit', branding: 'edit' }))).toBe(true)
  })

  it('lets a staff manager hand out only up to their own level, area by area', () => {
    const mgr = staff({ staff: 'edit', content: 'edit', shop: 'view' })
    expect(withinCeiling(mgr, perms({ content: 'edit', shop: 'view' }))).toBe(true)
    expect(withinCeiling(mgr, perms({ shop: 'edit' }))).toBe(false)
    expect(withinCeiling(mgr, perms({ branding: 'view' }))).toBe(false)
  })
})

describe('content sections', () => {
  it('maps every editable section (and media) to an area', () => {
    for (const key of [...Object.keys(SECTIONS), 'media']) expect(AREAS).toContain(SECTION_AREA[key as keyof typeof SECTION_AREA])
  })

  it('lists only the sections a person may edit', () => {
    const s = staff({ shop: 'edit', content: 'view' })
    expect(editableSections(s)).toEqual(['products'])
  })
})
