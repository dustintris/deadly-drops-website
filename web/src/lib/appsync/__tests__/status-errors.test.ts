import { describe, expect, it, vi } from 'vitest'

// the database is down: the lookup itself fails
vi.mock('@/lib/appsync/installs', () => ({
  findActiveInstall: async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432')
  },
  touchInstall: async () => {},
}))

const { GET: status } = await import('@/app/api/desktop/status/route')

describe('GET /api/desktop/status/ when the server has a problem', () => {
  it('answers 503, never 401 (the app would take a 401 as this computer being revoked)', async () => {
    const res = await status(new Request('https://ddptournaments.com/api/desktop/status/', { headers: { authorization: `Bearer ${'k'.repeat(43)}` } }))
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const out = await res.json()
    expect(out.active).toBeUndefined()
    expect(typeof out.message).toBe('string')
  })
})
