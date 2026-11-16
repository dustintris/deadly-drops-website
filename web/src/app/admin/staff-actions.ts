'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit'
import { verifyPassword } from '@/lib/auth/password'
import { can, LEVELS, normalizePerms, withinCeiling, type Perms } from '@/lib/auth/permissions'
import { clearFailures, HashBusyError, recordFailure, waitFor, withHashSlot } from '@/lib/auth/rate-limit'
import { currentSessionToken, getSession, type Session } from '@/lib/auth/session'
import {
  createUser,
  deleteUser,
  DuplicateEmailError,
  findUserForLogin,
  OwnerProtectedError,
  RefusedError,
  setDisabled,
  setPassword,
  updateUser,
  type Guard,
  type StaffUser,
} from '@/lib/auth/users'

/**
 * Staff logins. Every rule is enforced here on the server, whatever the browser sends, and
 * checked inside the same database transaction as the change (no gap to race through):
 * - managing logins needs `staff: edit`
 * - nobody changes their own access here (My account is for your own password)
 * - the owner account is managed on the server (npm run admin:setup), never here
 * - a manager who isn't the owner can only hand out access they have themselves, can't grant
 *   staff management, and can't change a login that has access they lack or that manages staff
 */

export type StaffResult = { ok: boolean; message: string; errors?: Record<string, string> }

const Password = z.string().min(12, 'Use at least 12 characters.').max(200, 'Use at most 200 characters.')
const Name = z.string().trim().min(1, 'Enter a name.').max(80, 'Keep the name under 80 characters.')
const PermsInput = z.record(z.string(), z.enum(LEVELS)).transform((p) => normalizePerms(p))
const NewStaff = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address.'),
  name: Name,
  password: Password,
  perms: PermsInput,
})
const EditStaff = z.object({ name: Name, perms: PermsInput })
const Id = z.number().int().positive()

function fieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const key = i.path.join('.') || '_'
    out[key] ??= i.message
  }
  return out
}

const invalid = (issues: z.ZodIssue[]): StaffResult => ({ ok: false, message: 'Fix the highlighted fields.', errors: fieldErrors(issues) })

/** The signed-in staff manager, or the reason they can't act. */
async function manager(): Promise<Session | StaffResult> {
  const s = await getSession()
  if (!s) return { ok: false, message: 'Your session ended. Sign in again.' }
  if (!can(s, 'staff', 'edit')) return { ok: false, message: 'You don’t have access to staff accounts.' }
  return s
}
const refused = (x: Session | StaffUser | StaffResult): x is StaffResult => 'ok' in x

/** Why this manager may not give out these permissions, or null. */
function grantProblem(s: Session, perms: Perms): string | null {
  if (s.isOwner) return null
  if (perms.staff !== 'none') return 'Only the owner can give access to staff accounts.'
  if (!withinCeiling(s, perms)) return 'You can only give access you have yourself.'
  return null
}

/** The rules for changing an existing login, run against the locked row inside the transaction. */
function guardFor(s: Session, nextPerms?: Perms): Guard {
  return (target) => {
    if (target.id === s.id) throw new RefusedError('You can’t change your own access. Use My account for your password.')
    if (s.isOwner) return
    if (target.perms.staff !== 'none') throw new RefusedError('Only the owner can change another staff manager.')
    if (!withinCeiling(s, target.perms)) throw new RefusedError('This login has access you don’t have, so only the owner can change it.')
    const why = nextPerms && grantProblem(s, nextPerms)
    if (why) throw new RefusedError(why)
  }
}

function failure(e: unknown, fallback: string): StaffResult {
  if (e instanceof RefusedError || e instanceof DuplicateEmailError || e instanceof OwnerProtectedError) return { ok: false, message: e.message }
  console.error(e)
  return { ok: false, message: fallback }
}

/** Run one change on an existing login; returns the login as it was, or why it didn't happen. */
async function change(rawId: unknown, fallback: string, run: (id: number) => Promise<StaffUser>): Promise<StaffUser | StaffResult> {
  const id = Id.safeParse(rawId)
  if (!id.success) return { ok: false, message: 'Unknown login.' }
  try {
    return await run(id.data)
  } catch (e) {
    return failure(e, fallback)
  }
}

const done = (message: string): StaffResult => {
  revalidatePath('/admin/staff/')
  return { ok: true, message }
}

export async function createStaff(input: unknown): Promise<StaffResult> {
  const s = await manager()
  if (refused(s)) return s
  const parsed = NewStaff.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const why = grantProblem(s, parsed.data.perms)
  if (why) return { ok: false, message: why }
  try {
    const u = await createUser(parsed.data)
    await audit(s.email, 'staff_create', u.email)
    return done(`Login created for ${u.email}. Give them the password in person or by phone, not by email.`)
  } catch (e) {
    return failure(e, 'Creating the login failed on the server. Try again.')
  }
}

export async function updateStaff(id: unknown, input: unknown): Promise<StaffResult> {
  const s = await manager()
  if (refused(s)) return s
  const parsed = EditStaff.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues)
  const target = await change(id, 'Saving failed on the server. Try again.', (uid) => updateUser(uid, parsed.data, guardFor(s, parsed.data.perms)))
  if (refused(target)) return target
  await audit(s.email, 'staff_update', target.email)
  return done(`Saved. ${target.email} gets the new access straight away.`)
}

export async function setStaffDisabled(id: unknown, disabled: boolean): Promise<StaffResult> {
  const s = await manager()
  if (refused(s)) return s
  const off = disabled === true
  const target = await change(id, 'That failed on the server. Try again.', (uid) => setDisabled(uid, off, guardFor(s)))
  if (refused(target)) return target
  await audit(s.email, off ? 'staff_disable' : 'staff_enable', target.email)
  return done(off ? `${target.email} is signed out and can’t sign in.` : `${target.email} can sign in again.`)
}

export async function resetStaffPassword(id: unknown, password: unknown): Promise<StaffResult> {
  const s = await manager()
  if (refused(s)) return s
  const pw = Password.safeParse(password)
  if (!pw.success) return invalid(pw.error.issues.map((i) => ({ ...i, path: ['password'] })))
  // signs them out everywhere
  const target = await change(id, 'Setting the password failed on the server. Try again.', (uid) => setPassword(uid, pw.data, undefined, guardFor(s)))
  if (refused(target)) return target
  await audit(s.email, 'staff_password_reset', target.email)
  return done(`New password set for ${target.email}. They’ve been signed out on every device.`)
}

export async function deleteStaff(id: unknown): Promise<StaffResult> {
  const s = await manager()
  if (refused(s)) return s
  const target = await change(id, 'Deleting failed on the server. Try again.', (uid) => deleteUser(uid, guardFor(s)))
  if (refused(target)) return target
  await audit(s.email, 'staff_delete', target.email)
  return done(`Login for ${target.email} deleted.`)
}

/** Change your own password. Other devices are signed out; this one stays signed in. */
export async function changeOwnPassword(current: unknown, next: unknown): Promise<StaffResult> {
  const s = await getSession()
  if (!s) return { ok: false, message: 'Your session ended. Sign in again.' }
  if (s.isOwner) return { ok: false, message: 'The owner password is set on the server: run npm run admin:setup and restart the site.' }
  const pw = Password.safeParse(next)
  if (!pw.success) return invalid(pw.error.issues.map((i) => ({ ...i, path: ['next'] })))
  if (typeof current !== 'string' || !current) return { ok: false, message: 'Enter your current password.', errors: { current: 'Enter your current password.' } }
  if (current === pw.data) return { ok: false, message: 'Choose a password different from the current one.', errors: { next: 'Choose a different password.' } }

  const key = `email:${s.email}`
  const wait = waitFor(key, 'email')
  if (wait > 0) return { ok: false, message: `Too many attempts. Try again in ${Math.ceil(wait / 60000)} minutes.` }
  recordFailure(key) // counted before checking, so parallel guesses can't slip past the limit
  const login = await findUserForLogin(s.email)
  let ok = false
  try {
    ok = !!login && (await withHashSlot(() => verifyPassword(current.slice(0, 1024), login.passwordHash)))
  } catch (e) {
    if (e instanceof HashBusyError) return { ok: false, message: e.message }
    throw e
  }
  if (!ok) return { ok: false, message: 'Your current password is wrong.', errors: { current: 'That isn’t your current password.' } }
  clearFailures(key)
  try {
    await setPassword(s.id, pw.data, await currentSessionToken())
    await audit(s.email, 'password_change')
    return { ok: true, message: 'Password changed. Your other devices have been signed out.' }
  } catch (e) {
    return failure(e, 'Changing the password failed on the server. Try again.')
  }
}
