import { describe, expect, it } from 'vitest'
import { sameContent, sectionHash } from '../content-schema'

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
