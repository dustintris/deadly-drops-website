import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, lt, ne, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { sessions, users } from '@/db/schema'
import { normalizePerms, type Perms } from './permissions'

/**
 * Signed-in devices, stored in PostgreSQL. The browser cookie holds a random token;
 * the database keeps only its SHA-256, so a leaked database can't be used to sign in.
 * Revoking access is deleting rows: sign out one device, or every device of a person.
 */

export type StaffUser = {
  id: number
  email: string
  name: string
  isOwner: boolean
  perms: Perms
  disabled: boolean
  createdAt: string
  lastLoginAt: string | null
}

type UserRow = typeof users.$inferSelect

export function toStaffUser(r: UserRow): StaffUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    isOwner: r.isOwner,
    perms: normalizePerms(r.perms),
    disabled: r.disabledAt !== null,
    createdAt: r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
  }
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Start a session for a person; returns the token to put in their cookie. */
export async function createSessionRow(userId: number, userAgent: string, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await getDb()
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, userAgent: userAgent.slice(0, 200), expiresAt: new Date(Date.now() + ttlMs) })
  return token
}

const TOUCH_EVERY = 5 * 60 * 1000

/** The person signed in with this token, if the session is current and the account is enabled. */
export async function findSessionUser(token: string): Promise<{ tokenHash: string; user: StaffUser } | null> {
  if (!token || token.length > 100) return null
  const tokenHash = hashToken(token)
  const [row] = await getDb()
    .select({ lastSeenAt: sessions.lastSeenAt, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, sql`now()`), isNull(users.disabledAt)))
    .limit(1)
  if (!row) return null
  // note activity now and then, not on every request
  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_EVERY) {
    await getDb().update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.tokenHash, tokenHash))
  }
  return { tokenHash, user: toStaffUser(row.user) }
}

/** Sign out the device holding this token. */
export async function deleteSessionByToken(token: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}

/** Sign a person out everywhere, optionally except the device holding `exceptToken`. */
export async function deleteUserSessions(userId: number, exceptToken?: string): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(exceptToken ? and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashToken(exceptToken))) : eq(sessions.userId, userId))
}

/** Housekeeping: drop sessions that have run out. */
export async function deleteExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, sql`now()`))
}
