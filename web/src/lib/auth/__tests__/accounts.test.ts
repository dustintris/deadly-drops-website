import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import { hashPassword, verifyPassword } from '../password'
import { normalizePerms } from '../permissions'
import { createSessionRow, deleteSessionByToken, deleteUserSessions, findSessionUser } from '../sessions'
import {
  createUser,
  deleteUser,
  DuplicateEmailError,
  findUserForLogin,
  getUser,
  listUsers,
  OwnerProtectedError,
  RefusedError,
  setDisabled,
  setPassword,
  syncEnvOwner,
  updateUser,
} from '../users'

const sql = () => getSql()
const HOUR = 60 * 60 * 1000

beforeEach(async () => {
  await sql()`truncate users, sessions restart identity cascade`
})

const newStaff = (email = 'Scorer@Example.com') =>
  createUser({ email, name: 'Sam Scorer', password: 'a long enough password', perms: normalizePerms({ scoring: 'edit' }) })

describe('staff accounts', () => {
  it('stores email in lower case and finds it case-insensitively', async () => {
    const u = await newStaff()
    expect(u.email).toBe('scorer@example.com')
    const found = await findUserForLogin('SCORER@example.COM')
    expect(found?.id).toBe(u.id)
    expect(await verifyPassword('a long enough password', found!.passwordHash)).toBe(true)
  })

  it('refuses a second account with the same email', async () => {
    await newStaff()
    await expect(newStaff('scorer@example.com')).rejects.toBeInstanceOf(DuplicateEmailError)
  })

  it('checks a guard inside the same transaction as the change, and writes nothing when it refuses', async () => {
    const u = await newStaff()
    const refuse = () => {
      throw new RefusedError('not allowed')
    }
    await expect(updateUser(u.id, { name: 'Changed', perms: normalizePerms({}) }, refuse)).rejects.toBeInstanceOf(RefusedError)
    await expect(setDisabled(u.id, true, refuse)).rejects.toBeInstanceOf(RefusedError)
    await expect(setPassword(u.id, 'another long password', undefined, refuse)).rejects.toBeInstanceOf(RefusedError)
    await expect(deleteUser(u.id, refuse)).rejects.toBeInstanceOf(RefusedError)
    const again = await getUser(u.id)
    expect(again).toMatchObject({ name: 'Sam Scorer', disabled: false })
  })

  it('updates name and permissions', async () => {
    const u = await newStaff()
    await updateUser(u.id, { name: 'Sam', perms: normalizePerms({ scoring: 'edit', checkin: 'edit' }) })
    const [again] = (await listUsers()).filter((x) => x.id === u.id)
    expect(again.name).toBe('Sam')
    expect(again.perms.checkin).toBe('edit')
  })
})

describe('owner from the server environment', () => {
  it('creates the owner on first boot and keeps the password in step with the environment', async () => {
    const hash1 = await hashPassword('first owner password')
    await syncEnvOwner({ email: 'Owner@Club.com', passwordHash: hash1 })
    const owner = (await listUsers()).find((x) => x.isOwner)!
    expect(owner.email).toBe('owner@club.com')

    const hash2 = await hashPassword('second owner password')
    await syncEnvOwner({ email: 'owner@club.com', passwordHash: hash2 })
    const login = await findUserForLogin('owner@club.com')
    expect(login?.passwordHash).toBe(hash2)
    expect((await listUsers()).filter((x) => x.isOwner)).toHaveLength(1)
  })

  it('turns an existing staff account with that email into the owner', async () => {
    const u = await newStaff('boss@club.com')
    await syncEnvOwner({ email: 'boss@club.com', passwordHash: await hashPassword('owner password here') })
    const owner = (await listUsers()).find((x) => x.id === u.id)!
    expect(owner.isOwner).toBe(true)
  })

  it('disables a previous owner when the owner email changes', async () => {
    await syncEnvOwner({ email: 'old@club.com', passwordHash: await hashPassword('old owner password') })
    await syncEnvOwner({ email: 'new@club.com', passwordHash: await hashPassword('new owner password') })
    const users = await listUsers()
    expect(users.find((x) => x.email === 'new@club.com')?.isOwner).toBe(true)
    const old = users.find((x) => x.email === 'old@club.com')!
    expect(old.isOwner).toBe(false)
    expect(old.disabled).toBe(true)
  })

  it('protects the owner from being disabled or deleted', async () => {
    await syncEnvOwner({ email: 'owner@club.com', passwordHash: await hashPassword('owner password here') })
    const owner = (await listUsers()).find((x) => x.isOwner)!
    await expect(setDisabled(owner.id, true)).rejects.toBeInstanceOf(OwnerProtectedError)
    await expect(deleteUser(owner.id)).rejects.toBeInstanceOf(OwnerProtectedError)
  })
})

describe('sessions', () => {
  it('returns the signed-in user for a valid token, and nothing for an unknown one', async () => {
    const u = await newStaff()
    const token = await createSessionRow(u.id, 'test-agent', 8 * HOUR)
    const found = await findSessionUser(token)
    expect(found?.user.email).toBe('scorer@example.com')
    expect(found?.user.perms.scoring).toBe('edit')
    expect(await findSessionUser('not-a-real-token')).toBeNull()
  })

  it('stores only a hash of the token', async () => {
    const u = await newStaff()
    const token = await createSessionRow(u.id, '', 8 * HOUR)
    const rows = await sql()`select token_hash from sessions`
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).not.toContain(token)
  })

  it('rejects an expired session', async () => {
    const u = await newStaff()
    const token = await createSessionRow(u.id, '', -1000)
    expect(await findSessionUser(token)).toBeNull()
  })

  it('ends every session of a user who is disabled, and refuses them afterwards', async () => {
    const u = await newStaff()
    const token = await createSessionRow(u.id, '', 8 * HOUR)
    await setDisabled(u.id, true)
    expect(await findSessionUser(token)).toBeNull()
    const [{ count }] = await sql()`select count(*)::int as count from sessions`
    expect(count).toBe(0)
  })

  it('signs out one device without touching the others', async () => {
    const u = await newStaff()
    const phone = await createSessionRow(u.id, 'phone', 8 * HOUR)
    const laptop = await createSessionRow(u.id, 'laptop', 8 * HOUR)
    await deleteSessionByToken(phone)
    expect(await findSessionUser(phone)).toBeNull()
    expect(await findSessionUser(laptop)).not.toBeNull()
  })

  it('a password change signs out every other session but keeps the current one', async () => {
    const u = await newStaff()
    const current = await createSessionRow(u.id, 'laptop', 8 * HOUR)
    const other = await createSessionRow(u.id, 'phone', 8 * HOUR)
    await setPassword(u.id, 'a brand new long password', current)
    expect(await findSessionUser(current)).not.toBeNull()
    expect(await findSessionUser(other)).toBeNull()
    const login = await findUserForLogin(u.email)
    expect(await verifyPassword('a brand new long password', login!.passwordHash)).toBe(true)
  })

  it('deleteUserSessions with no exception signs the user out everywhere', async () => {
    const u = await newStaff()
    const a = await createSessionRow(u.id, '', 8 * HOUR)
    await deleteUserSessions(u.id)
    expect(await findSessionUser(a)).toBeNull()
  })
})
