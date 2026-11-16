'use server'

import { revalidatePath } from 'next/cache'
import { draftMode, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { audit } from '@/lib/audit'
import { verifyPassword } from '@/lib/auth/password'
import { clearFailures, clientIp, recordFailure, waitFor, withHashSlot } from '@/lib/auth/rate-limit'
import { adminConfigured, createSession, destroySession, requireAdmin, revokeAllSessions } from '@/lib/auth/session'
import { MediaAsset, SECTIONS, sectionHash, type SectionKey, type SiteContent } from '@/lib/content-schema'
import { findUsage } from '@/lib/media-usage'
import { discardDraft, publish, readPublished, saveDraftSection, StaleRevisionError, updateDraft } from '@/lib/store/content-store'
import { removeImage } from '@/lib/store/media-store'

export type ActionResult = { ok: boolean; message: string; errors?: Record<string, string>; rev?: number; email?: string; hash?: string }

/* ---------- login ---------- */

export async function login(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!adminConfigured()) return { ok: false, message: 'The admin login is not set up yet. Run npm run admin:setup on the server.' }
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 254)
  const password = String(form.get('password') ?? '').slice(0, 1024)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return { ok: false, message: 'Enter your email and password.', email }
  const ip = clientIp(await headers())
  const wait = Math.max(waitFor(`ip:${ip}`, 'ip'), waitFor(`email:${email}`, 'email'))
  if (wait > 0) {
    const mins = Math.ceil(wait / 60000)
    return { ok: false, message: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, email }
  }

  const okEmail = email === (process.env.ADMIN_EMAIL ?? '').toLowerCase()
  // always run the hash so a wrong email takes as long as a wrong password; at most 2 hashes at once
  const okPassword = await withHashSlot(() =>
    verifyPassword(password, process.env.ADMIN_PASSWORD_HASH ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='))
  if (!okEmail || !okPassword) {
    recordFailure(`ip:${ip}`)
    recordFailure(`email:${email}`)
    await audit(email, 'login_failed', ip)
    return { ok: false, message: 'That email or password is wrong.', email }
  }
  clearFailures(`ip:${ip}`)
  clearFailures(`email:${email}`)
  await createSession(process.env.ADMIN_EMAIL!)
  await audit(email, 'login', ip)
  redirect('/admin/')
}

export async function logout() {
  const s = await requireAdmin()
  await revokeAllSessions()
  await destroySession()
  ;(await draftMode()).disable()
  await audit(s.email, 'logout')
  redirect('/admin/login/')
}

/* ---------- content ---------- */

function zodErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const key = i.path.join('.') || '_'
    if (!out[key]) out[key] = i.message
  }
  return out
}

/** Save one section of the draft. The client sends the whole section as JSON. */
export async function saveSection(section: SectionKey, json: string, baseHash: string): Promise<ActionResult> {
  const s = await requireAdmin()
  if (!Object.hasOwn(SECTIONS, section)) return { ok: false, message: 'Unknown section.' }
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { ok: false, message: 'Could not read the form. Reload and try again.' }
  }
  const parsed = SECTIONS[section].safeParse(value)
  if (!parsed.success) {
    const errors = zodErrors(parsed.error.issues)
    return { ok: false, message: `Fix ${Object.keys(errors).length === 1 ? 'the highlighted field' : `${Object.keys(errors).length} fields`} and save again.`, errors }
  }
  try {
    const next = await saveDraftSection(section, parsed.data as SiteContent[typeof section], baseHash)
    await audit(s.email, 'save', section)
    return { ok: true, message: 'Saved as a draft. Publish to put it live.', rev: next.rev, hash: sectionHash(next[section]) }
  } catch (e) {
    if (e instanceof StaleRevisionError) return { ok: false, message: e.message }
    console.error(e)
    return { ok: false, message: 'Saving failed on the server. Try again.' }
  }
}

export async function publishDraft(): Promise<ActionResult> {
  const s = await requireAdmin()
  const live = await publish()
  revalidatePath('/', 'layout')
  await audit(s.email, 'publish', `rev ${live.rev}`)
  return { ok: true, message: 'Published. The live site now shows your changes.', rev: live.rev }
}

export async function discardChanges(): Promise<ActionResult> {
  const s = await requireAdmin()
  const d = await discardDraft()
  await audit(s.email, 'discard')
  return { ok: true, message: 'Draft reset to what is live.', rev: d.rev }
}

/* ---------- media ---------- */

export async function updateMediaAlt(id: string, alt: string): Promise<ActionResult> {
  const s = await requireAdmin()
  const parsed = MediaAsset.shape.alt.safeParse(alt)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message }
  const d = await updateDraft((doc) => ({ ...doc, media: doc.media.map((m) => (m.id === id ? { ...m, alt: parsed.data } : m)) }))
  await audit(s.email, 'media_alt', id)
  return { ok: true, message: 'Description saved.', rev: d.rev }
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const s = await requireAdmin()
  let file = ''
  try {
    // check and remove in one locked step, so a save in another tab cannot start using the image in between
    const d = await updateDraft((doc) => {
      const asset = doc.media.find((m) => m.id === id)
      if (!asset) throw new UserFacingError('That image is already gone.')
      const used = findUsage(`/media/${asset.file}`, doc)
      if (used.length) throw new UserFacingError(`Still used by ${used.join(', ')}. Replace it there first.`)
      file = asset.file
      return { ...doc, media: doc.media.filter((m) => m.id !== id) }
    })
    // the live site may still show it until the next publish, so only remove a file no live page uses
    if (!findUsage(`/media/${file}`, await readPublished()).length) await removeImage(file)
    await audit(s.email, 'media_delete', file)
    return { ok: true, message: 'Image deleted.', rev: d.rev }
  } catch (e) {
    if (e instanceof UserFacingError) return { ok: false, message: e.message }
    console.error(e)
    return { ok: false, message: 'Deleting failed on the server. Try again.' }
  }
}

class UserFacingError extends Error {}
