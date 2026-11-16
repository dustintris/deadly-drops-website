import { describe, expect, it } from 'vitest'
import { HashBusyError, recordFailure, waitFor, withHashSlot } from '../rate-limit'

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('withHashSlot()', () => {
  it('never runs more than two hashes at once, even in a burst', async () => {
    let running = 0
    let peak = 0
    const job = () =>
      withHashSlot(async () => {
        running++
        peak = Math.max(peak, running)
        await tick()
        running--
      })
    await Promise.all(Array.from({ length: 12 }, job))
    expect(peak).toBe(2)
  })

  it('turns new work away when too many are already waiting', async () => {
    const slow = () => withHashSlot(() => new Promise<void>((r) => setTimeout(r, 30)))
    const results = await Promise.allSettled(Array.from({ length: 80 }, slow))
    expect(results.some((r) => r.status === 'rejected' && r.reason instanceof HashBusyError)).toBe(true)
  })
})

describe('login throttling', () => {
  it('blocks an address after 10 failures, separately from email backoff', () => {
    const ip = `ip:test-${Math.random()}`
    for (let i = 0; i < 10; i++) recordFailure(ip)
    expect(waitFor(ip, 'ip')).toBeGreaterThan(0)
  })

  it('keeps an address blocked when random emails flood the email counter', () => {
    const ip = `ip:flood-${Math.random()}`
    for (let i = 0; i < 10; i++) recordFailure(ip)
    for (let i = 0; i < 12_000; i++) recordFailure(`email:spray-${i}@example.com`)
    expect(waitFor(ip, 'ip')).toBeGreaterThan(0)
  })
})
