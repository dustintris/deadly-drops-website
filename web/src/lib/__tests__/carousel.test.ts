import { describe, expect, it } from 'vitest'
import { dotWindow, isNeighbour, loadsEagerly, slideAt, wrap } from '../carousel'

describe('wrap', () => {
  it('comes round past either end', () => {
    expect(wrap(17, 17)).toBe(0)
    expect(wrap(-1, 17)).toBe(16)
    expect(wrap(3, 17)).toBe(3)
    expect(wrap(-18, 17)).toBe(16)
  })

  it('stays at 0 with no photos', () => {
    expect(wrap(4, 0)).toBe(0)
  })
})

describe('slideAt', () => {
  it('picks the nearest slide', () => {
    expect(slideAt(0, 400, 5)).toBe(0)
    expect(slideAt(190, 400, 5)).toBe(0)
    expect(slideAt(210, 400, 5)).toBe(1)
    expect(slideAt(1600, 400, 5)).toBe(4)
  })

  it('stays in the list while the track bounces past an end', () => {
    expect(slideAt(-30, 400, 5)).toBe(0)
    expect(slideAt(2400, 400, 5)).toBe(4)
  })

  it('is 0 before the track has a width', () => {
    expect(slideAt(300, 0, 5)).toBe(0)
  })
})

describe('loadsEagerly', () => {
  const eager = (current: number, count: number) =>
    Array.from({ length: count }, (_, i) => i).filter((i) => loadsEagerly(i, current, count))

  it('loads the photo on show and its neighbours, round the ends too', () => {
    expect(eager(0, 17)).toEqual([0, 1, 16])
    expect(eager(5, 17)).toEqual([4, 5, 6])
    expect(eager(16, 17)).toEqual([0, 15, 16])
  })

  it('loads every photo of a short album', () => {
    expect(eager(0, 1)).toEqual([0])
    expect(eager(1, 2)).toEqual([0, 1])
    expect(eager(2, 3)).toEqual([0, 1, 2])
  })

  it('loads nothing with no photos', () => {
    expect(loadsEagerly(0, 0, 0)).toBe(false)
  })
})

describe('isNeighbour', () => {
  it('glides one step, cuts longer jumps and the wrap round the end', () => {
    expect(isNeighbour(3, 4)).toBe(true)
    expect(isNeighbour(4, 3)).toBe(true)
    expect(isNeighbour(16, 0)).toBe(false)
    expect(isNeighbour(2, 6)).toBe(false)
  })
})

describe('dotWindow', () => {
  const shown = (current: number, count: number, max?: number) => dotWindow(current, count, max).map((d) => d.i)
  const edges = (current: number, count: number, max?: number) => dotWindow(current, count, max).filter((d) => d.edge).map((d) => d.i)

  it('shows a dot per photo up to the limit, none shrunk', () => {
    expect(shown(2, 5)).toEqual([0, 1, 2, 3, 4])
    expect(edges(2, 5)).toEqual([])
    expect(shown(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('shows no dots for a single photo', () => {
    expect(dotWindow(0, 1)).toEqual([])
    expect(dotWindow(0, 0)).toEqual([])
  })

  it('follows the current photo through a long album, shrinking the ends with more beyond', () => {
    expect(shown(0, 60)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(edges(0, 60)).toEqual([6])
    expect(shown(30, 60)).toEqual([27, 28, 29, 30, 31, 32, 33])
    expect(edges(30, 60)).toEqual([27, 33])
    expect(shown(59, 60)).toEqual([53, 54, 55, 56, 57, 58, 59])
    expect(edges(59, 60)).toEqual([53])
  })

  it('always includes the current photo', () => {
    for (let current = 0; current < 23; current++) expect(shown(current, 23)).toContain(current)
  })
})
