import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { audit, recentAudit } from '../audit'

beforeEach(async () => {
  await getSql()`truncate audit_log`
})

describe('audit log (PostgreSQL)', () => {
  it('returns the newest entries first, limited to n', async () => {
    await audit('owner@example.com', 'save', 'faqs')
    await audit('owner@example.com', 'publish')
    await audit('staff@example.com', 'upload', 'photo.jpg')

    const entries = await recentAudit(2)

    expect(entries.map((e) => e.action)).toEqual(['upload', 'publish'])
    expect(entries[0]).toMatchObject({ who: 'staff@example.com', detail: 'photo.jpg' })
    expect(new Date(entries[0].at).toString()).not.toBe('Invalid Date')
  })

  it('caps field lengths so one entry cannot bloat the log', async () => {
    await audit('x'.repeat(400), 'y'.repeat(100), 'z'.repeat(1000))
    const [entry] = await recentAudit(1)
    expect(entry.who).toHaveLength(254)
    expect(entry.action).toHaveLength(40)
    expect(entry.detail).toHaveLength(300)
  })
})
