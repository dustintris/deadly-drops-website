'use server'

import { revalidatePath } from 'next/cache'
import { audit } from '@/lib/audit'
import { can } from '@/lib/auth/permissions'
import { getSession } from '@/lib/auth/session'
import { revokeAppKey, rotateAppKey } from '@/lib/appsync/key'

/**
 * The desktop app's download key. Making, replacing or turning it off needs `staff: edit` (it opens
 * every tournament's teams, hidden ones too), checked here on the server.
 */
export type KeyResult = { ok: boolean; message: string; key?: string }

async function allowed() {
  const s = await getSession()
  if (!s) return { refused: { ok: false, message: 'Your session ended. Sign in again.' } as KeyResult }
  if (!can(s, 'staff', 'edit')) return { refused: { ok: false, message: 'Only the owner or a staff manager can change the desktop app key.' } as KeyResult }
  return { s }
}

export async function rotateAppKeyAction(): Promise<KeyResult> {
  const a = await allowed()
  if ('refused' in a) return a.refused!
  try {
    const key = await rotateAppKey()
    await audit(a.s.email, 'desktop_key_rotate')
    revalidatePath('/admin/desktop-app/')
    return { ok: true, message: 'New key made. Copy it into the desktop app now: it won’t be shown again.', key }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Making the key failed on the server. Try again.' }
  }
}

export async function revokeAppKeyAction(): Promise<KeyResult> {
  const a = await allowed()
  if ('refused' in a) return a.refused!
  try {
    await revokeAppKey()
    await audit(a.s.email, 'desktop_key_revoke')
    revalidatePath('/admin/desktop-app/')
    return { ok: true, message: 'Turned off. The desktop app can’t download until you make a new key.' }
  } catch (e) {
    console.error(e)
    return { ok: false, message: 'Turning it off failed on the server. Try again.' }
  }
}
