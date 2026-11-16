import 'server-only'
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { getDb, type Db } from '@/db/client'
import { sessions, users } from '@/db/schema'
import { hashPassword } from './password'
import { AREAS, normalizePerms, type Perms } from './permissions'
import { deleteExpiredSessions, hashToken, toStaffUser, type StaffUser } from './sessions'

export type { StaffUser } from './sessions'

/**
 * Staff accounts. The owner is the account named by ADMIN_EMAIL / ADMIN_PASSWORD_HASH on the
 * server: synced from there, it always has every permission and can't be disabled, deleted or
 * changed from the admin, so nobody can lock the club out. Everyone else is managed in the admin.
 */

export class DuplicateEmailError extends Error {
  constructor() {
    super('Someone already has a login with that email.')
  }
}

export class OwnerProtectedError extends Error {
  constructor() {
    super('The owner account is managed on the server (npm run admin:setup), not here.')
  }
}

/** A change refused by the caller's rules (thrown by a Guard); the message is safe to show. */
export class RefusedError extends Error {}

/**
 * The caller's rules for changing a login, checked against the row as it is inside the write's
 * transaction (locked), so nothing can change it between the check and the write. Throw a
 * RefusedError to stop.
 */
export type Guard = (target: StaffUser) => void

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const OWNER_LOCK = 0x0dd9_0e1e
const ALL_EDIT = normalizePerms(Object.fromEntries(AREAS.map((a) => [a, 'edit'])))
const normEmail = (email: string) => email.trim().toLowerCase()

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } }
  return err?.code === '23505' || err?.cause?.code === '23505'
}

/** Lock the target row for this transaction; refuse the owner and whatever the guard refuses. */
async function lockTarget(tx: Tx, id: number, guard?: Guard): Promise<StaffUser> {
  const [row] = await tx.select().from(users).where(eq(users.id, id)).limit(1).for('update')
  if (!row) throw new RefusedError('That login no longer exists.')
  if (row.isOwner) throw new OwnerProtectedError()
  const target = toStaffUser(row)
  guard?.(target)
  return target
}

export async function listUsers(): Promise<StaffUser[]> {
  const rows = await getDb().select().from(users).orderBy(desc(users.isOwner), asc(sql`lower(${users.name})`), asc(users.email))
  return rows.map(toStaffUser)
}

export async function getUser(id: number): Promise<StaffUser | null> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1)
  return row ? toStaffUser(row) : null
}

export async function countUsers(): Promise<number> {
  const [{ n }] = await getDb().select({ n: sql<number>`count(*)::int` }).from(users)
  return n
}

/** What login needs: the hash to check, and whether the account may sign in. */
export async function findUserForLogin(email: string): Promise<{ id: number; email: string; passwordHash: string; disabled: boolean } | null> {
  const [row] = await getDb()
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.email, normEmail(email)))
    .limit(1)
  return row ? { id: row.id, email: row.email, passwordHash: row.passwordHash, disabled: row.disabledAt !== null } : null
}

export async function createUser(input: { email: string; name: string; password: string; perms: Perms }): Promise<StaffUser> {
  const passwordHash = await hashPassword(input.password)
  try {
    const [row] = await getDb()
      .insert(users)
      .values({ email: normEmail(input.email), name: input.name.trim(), passwordHash, perms: normalizePerms(input.perms) })
      .returning()
    return toStaffUser(row)
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateEmailError()
    throw e
  }
}

export async function updateUser(id: number, input: { name: string; perms: Perms }, guard?: Guard): Promise<StaffUser> {
  return getDb().transaction(async (tx) => {
    const target = await lockTarget(tx, id, guard)
    await tx.update(users).set({ name: input.name.trim(), perms: normalizePerms(input.perms) }).where(eq(users.id, id))
    return target
  })
}

/** Disabling signs the person out everywhere at once. */
export async function setDisabled(id: number, disabled: boolean, guard?: Guard): Promise<StaffUser> {
  return getDb().transaction(async (tx) => {
    const target = await lockTarget(tx, id, guard)
    await tx.update(users).set({ disabledAt: disabled ? new Date() : null }).where(eq(users.id, id))
    if (disabled) await tx.delete(sessions).where(eq(sessions.userId, id))
    return target
  })
}

export async function deleteUser(id: number, guard?: Guard): Promise<StaffUser> {
  return getDb().transaction(async (tx) => {
    const target = await lockTarget(tx, id, guard)
    await tx.delete(users).where(eq(users.id, id)) // their sessions go with them (on delete cascade)
    return target
  })
}

/** New password; every other device of that person is signed out (the one holding `keepToken` stays). */
export async function setPassword(id: number, password: string, keepToken?: string, guard?: Guard): Promise<StaffUser> {
  const passwordHash = await hashPassword(password) // slow: done before the transaction opens
  return getDb().transaction(async (tx) => {
    const target = await lockTarget(tx, id, guard)
    await tx.update(users).set({ passwordHash }).where(eq(users.id, id))
    await tx
      .delete(sessions)
      .where(keepToken ? and(eq(sessions.userId, id), ne(sessions.tokenHash, hashToken(keepToken))) : eq(sessions.userId, id))
    return target
  })
}

export async function recordLogin(id: number): Promise<void> {
  await getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id))
  await deleteExpiredSessions()
}

/**
 * Make the server's owner (ADMIN_EMAIL / ADMIN_PASSWORD_HASH) the one owner account.
 * - creates it, or promotes an existing staff login with that email
 * - keeps its password in step with the server; a changed password signs the owner out everywhere
 * - a previous owner (the email changed) is demoted and disabled, and signed out
 */
export async function syncEnvOwner(env: { email: string; passwordHash: string }): Promise<void> {
  const email = normEmail(env.email)
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${OWNER_LOCK})`)

    const previous = await tx
      .update(users)
      .set({ isOwner: false, disabledAt: sql`coalesce(${users.disabledAt}, now())` })
      .where(and(eq(users.isOwner, true), ne(users.email, email)))
      .returning({ id: users.id })
    if (previous.length) await tx.delete(sessions).where(inArray(sessions.userId, previous.map((p) => p.id)))

    const [existing] = await tx.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1)
    if (!existing) {
      await tx.insert(users).values({ email, passwordHash: env.passwordHash, perms: ALL_EDIT, isOwner: true })
      return
    }
    await tx.update(users).set({ isOwner: true, passwordHash: env.passwordHash, perms: ALL_EDIT, disabledAt: null }).where(eq(users.id, existing.id))
    if (existing.passwordHash !== env.passwordHash) await tx.delete(sessions).where(eq(sessions.userId, existing.id))
  })
}
