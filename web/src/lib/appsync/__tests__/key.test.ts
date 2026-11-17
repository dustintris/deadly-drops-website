import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { appKeyStatus, bearerKey, revokeAppKey, rotateAppKey, verifyAppKey } from '../key'

beforeEach(async () => {
  await getSql()`delete from app_meta where key = 'desktop_app_key'`
})

describe('desktop app key', () => {
  it('lets nothing in until a key is made', async () => {
    expect(await verifyAppKey('anything')).toBe(false)
    expect(await verifyAppKey(null)).toBe(false)
    expect((await appKeyStatus()).set).toBe(false)
  })

  it('makes a long random key that verifies, storing only its hash', async () => {
    const key = await rotateAppKey()
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await verifyAppKey(key)).toBe(true)
    expect(await verifyAppKey(key + 'x')).toBe(false)
    const [row] = await getSql()`select value from app_meta where key = 'desktop_app_key'`
    expect(row.value).not.toContain(key)
    expect((await appKeyStatus()).set).toBe(true)
  })

  it('stops the old key when a new one is made, and every key when turned off', async () => {
    const first = await rotateAppKey()
    const second = await rotateAppKey()
    expect(await verifyAppKey(first)).toBe(false)
    expect(await verifyAppKey(second)).toBe(true)
    await revokeAppKey()
    expect(await verifyAppKey(second)).toBe(false)
  })

  it('reads the key from an Authorization: Bearer header only', () => {
    expect(bearerKey('Bearer abc')).toBe('abc')
    expect(bearerKey('bearer abc')).toBe('abc')
    expect(bearerKey('Basic abc')).toBeNull()
    expect(bearerKey(null)).toBeNull()
    expect(bearerKey('Bearer ')).toBeNull()
  })
})
