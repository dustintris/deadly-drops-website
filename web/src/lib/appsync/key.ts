import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { appMeta } from '@/db/schema'

/**
 * The secret key the desktop Pickle Match app sends (Authorization: Bearer <key>) to download
 * tournaments. Made and replaced in Admin → Desktop app; only its SHA-256 is stored, so the key is
 * shown once and can't be read back. No key set = the download API is off.
 */

const META_KEY = 'desktop_app_key'
type Stored = { hash: string; createdAt: string }

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest()

/** The stored hash, kept for a few seconds so refused requests don't each hit the database. */
let cache: { at: number; value: Stored | null } | null = null
const CACHE_MS = 15_000

async function stored(): Promise<Stored | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value
  const value = await readStored()
  cache = { at: Date.now(), value }
  return value
}

async function readStored(): Promise<Stored | null> {
  const [row] = await getDb().select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, META_KEY)).limit(1)
  if (!row) return null
  try {
    const v = JSON.parse(row.value) as Partial<Stored>
    return typeof v.hash === 'string' && typeof v.createdAt === 'string' ? { hash: v.hash, createdAt: v.createdAt } : null
  } catch {
    return null
  }
}

/** A new key (replacing any old one). Returned once; only its hash is kept. */
export async function rotateAppKey(): Promise<string> {
  const key = randomBytes(32).toString('base64url')
  const value = JSON.stringify({ hash: sha256(key).toString('hex'), createdAt: new Date().toISOString() } satisfies Stored)
  await getDb().insert(appMeta).values({ key: META_KEY, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } })
  cache = null
  return key
}

export async function revokeAppKey(): Promise<void> {
  await getDb().delete(appMeta).where(eq(appMeta.key, META_KEY))
  cache = null
}

export async function appKeyStatus(): Promise<{ set: boolean; createdAt: string | null }> {
  const s = await readStored()
  return { set: s !== null, createdAt: s?.createdAt ?? null }
}

export async function verifyAppKey(key: string | null): Promise<boolean> {
  if (!key || key.length > 200) return false
  const s = await stored()
  if (!s) return false
  const expected = Buffer.from(s.hash, 'hex')
  const given = sha256(key)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** "Bearer abc" → "abc"; anything else → null. */
export function bearerKey(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(\S+)\s*$/i)
  return m ? m[1] : null
}
