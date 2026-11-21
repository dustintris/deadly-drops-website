'use server'

import { revalidatePath } from 'next/cache'
import { audit } from '@/lib/audit'
import { can } from '@/lib/auth/permissions'
import { getSession } from '@/lib/auth/session'
import { cleanText, DesktopSetupError } from '@/lib/appsync/codes'
import { cancelActivationCode, createActivationCode, revokeInstall, TooManyCodesError } from '@/lib/appsync/installs'
import { revokeAppKey, rotateAppKey } from '@/lib/appsync/key'

/**
 * Admin → Desktop app. Everything here needs `staff: edit` (a key opens every tournament's teams, hidden ones too, and
 * the installer), checked here on the server: activation codes, revoking a computer, and the older shared key.
 *
 * Only the database write can fail an action. Once it's committed, the audit entry (audit() logs its own failures
 * and never throws) and the page refresh come after the try, so a done change is never reported as failed.
 */
export type KeyResult = { ok: boolean; message: string; key?: string }

/** `code` is in the reply once, for the admin to read out or copy; it is never logged or stored as is. */
export type ActivationResult = { ok: boolean; message: string; id?: number; code?: string; label?: string; expiresAt?: string }

const PAGE = '/admin/desktop-app/'
const AGAIN = 'Something went wrong. Reload the page and try again.'
const validId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
const firstLine = (e: unknown) => (e instanceof Error ? e.message.split('\n')[0] : 'error')

async function allowed() {
  const s = await getSession()
  if (!s) return { refused: 'Your session ended. Sign in again.' }
  if (!can(s, 'staff', 'edit')) return { refused: 'Only the owner or a staff manager can change the desktop app’s access.' }
  return { s }
}

export async function rotateAppKeyAction(): Promise<KeyResult> {
  const a = await allowed()
  if ('refused' in a) return { ok: false, message: a.refused! }
  let key: string
  try {
    key = await rotateAppKey()
  } catch (e) {
    console.error('[desktop] making the shared key failed:', firstLine(e))
    return { ok: false, message: 'Making the key failed on the server. Try again.' }
  }
  await audit(a.s.email, 'desktop_key_rotate')
  revalidatePath(PAGE)
  return { ok: true, message: 'New key made. Copy it into the desktop app now: it won’t be shown again.', key }
}

export async function revokeAppKeyAction(): Promise<KeyResult> {
  const a = await allowed()
  if ('refused' in a) return { ok: false, message: a.refused! }
  try {
    await revokeAppKey()
  } catch (e) {
    console.error('[desktop] turning off the shared key failed:', firstLine(e))
    return { ok: false, message: 'Turning it off failed on the server. Try again.' }
  }
  await audit(a.s.email, 'desktop_key_revoke')
  revalidatePath(PAGE)
  return { ok: true, message: 'Turned off. Older copies of the app can’t download until you make a new key.' }
}

/** A one-time code that activates one computer, called `label` ("Venue laptop") in the list. */
export async function createActivationCodeAction(label: unknown): Promise<ActivationResult> {
  const a = await allowed()
  if ('refused' in a) return { ok: false, message: a.refused! }
  if (typeof label !== 'string' || label.length > 500) return { ok: false, message: AGAIN }
  const name = cleanText(label, 61)
  if (!name) return { ok: false, message: 'Give the computer a name first, e.g. Venue laptop.' }
  if (Array.from(name).length > 60) return { ok: false, message: 'Keep the name to 60 characters or fewer.' }
  let made: Awaited<ReturnType<typeof createActivationCode>>
  try {
    made = await createActivationCode(name, a.s.email)
  } catch (e) {
    if (e instanceof DesktopSetupError || e instanceof TooManyCodesError) return { ok: false, message: e.message }
    console.error('[desktop] making a code failed:', firstLine(e))
    return { ok: false, message: 'Making the code failed on the server. Try again.' }
  }
  await audit(a.s.email, 'desktop_code_create', `#${made.id} ${made.label}, until ${made.expiresAt.slice(0, 10)}`)
  revalidatePath(PAGE)
  return { ok: true, message: `Code made for ${made.label}. It works once, within 7 days.`, id: made.id, code: made.code, label: made.label, expiresAt: made.expiresAt }
}

export async function cancelActivationCodeAction(id: unknown): Promise<ActivationResult> {
  const a = await allowed()
  if ('refused' in a) return { ok: false, message: a.refused! }
  if (!validId(id)) return { ok: false, message: AGAIN }
  let label: string | null
  try {
    label = await cancelActivationCode(id)
  } catch (e) {
    console.error('[desktop] cancelling a code failed:', firstLine(e))
    return { ok: false, message: 'Cancelling failed on the server. Try again.' }
  }
  revalidatePath(PAGE)
  if (label === null) return { ok: false, message: 'That code was already used or cancelled. The list is up to date now.' }
  await audit(a.s.email, 'desktop_code_cancel', `#${id} ${label}`)
  return { ok: true, message: `Cancelled the code for ${label}. It won’t work now.` }
}

/** Stop one computer: its key no longer downloads tournaments, the installer or updates. */
export async function revokeInstallAction(id: unknown): Promise<ActivationResult> {
  const a = await allowed()
  if ('refused' in a) return { ok: false, message: a.refused! }
  if (!validId(id)) return { ok: false, message: AGAIN }
  let label: string | null
  try {
    label = await revokeInstall(id)
  } catch (e) {
    console.error('[desktop] revoking failed:', firstLine(e))
    return { ok: false, message: 'Revoking failed on the server. Try again.' }
  }
  revalidatePath(PAGE)
  if (label === null) return { ok: false, message: 'That computer was already revoked. The list is up to date now.' }
  await audit(a.s.email, 'desktop_install_revoke', `#${id} ${label}`)
  return { ok: true, message: `Revoked ${label}. The app on that computer stops working with the website.` }
}
