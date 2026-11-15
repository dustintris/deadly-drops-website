'use server'

import { revalidatePath } from 'next/cache'
import { draftMode, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { audit } from '@/lib/audit'
import { verifyPassword } from '@/lib/auth/password'
import { clearFailures, isLocked, recordFailure } from '@/lib/auth/rate-limit'
import { adminConfigured, createSession, destroySession, requireAdmin } from '@/lib/auth/session'
import { MediaAsset, SECTIONS, sectionHash, type SectionKey, type SiteContent } from '@/lib/content-schema'
import { discardDraft, publish, readDraft, saveDraftSection, StaleRevisionError, updateDraft } from '@/lib/store/file-store'
import { removeImage } from '@/lib/store/media-store'

export type ActionResult = { ok: boolean; message: string; errors?: Record<string, string>; rev?: number; email?: string; hash?: string }

/* ---------- login ---------- */

export async function login(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!adminConfigured()) return { ok: false, message: 'The admin login is not set up yet. Run npm run admin:setup on the server.' }
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const password = String(form.get('password') ?? '')
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  const keys = [`ip:${ip}`, `email:${email}`]
  if (keys.some(isLocked)) return { ok: false, message: 'Too many attempts. Wait 15 minutes and try again.', email }

  const okEmail = email === (process.env.ADMIN_EMAIL ?? '').toLowerCase()
  // always run the hash so a wrong email takes as long as a wrong password
  const okPassword = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')
  if (!okEmail || !okPassword) {
    keys.forEach(recordFailure)
    await audit(email || 'unknown', 'login_failed', ip)
    return { ok: false, message: 'That email or password is wrong.', email }
  }
  keys.forEach(clearFailures)
  await createSession(process.env.ADMIN_EMAIL!)
  await audit(email, 'login', ip)
  redirect('/admin/')
}

export async function logout() {
  const s = await requireAdmin()
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
  if (!(section in SECTIONS)) return { ok: false, message: 'Unknown section.' }
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

/** Where an image is used, so the owner never deletes a picture the site still shows. */
export async function findUsage(src: string, doc?: SiteContent): Promise<string[]> {
  const d = doc ?? (await readDraft())
  const where: string[] = []
  const has = (v: unknown) => JSON.stringify(v).includes(`"${src}"`)
  d.events.forEach((e) => has(e) && where.push(`Event: ${e.name}`))
  d.products.forEach((p) => has(p) && where.push(`Product: ${p.name}`))
  d.gallery.forEach((g) => has(g) && where.push(`Gallery: ${g.caption}`))
  d.posts.forEach((p) => has(p) && where.push(`Community: ${p.title}`))
  Object.entries(d.pages).forEach(([k, p]) => has(p) && where.push(`Page: ${k}`))
  return where
}

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
  const doc = await readDraft()
  const asset = doc.media.find((m) => m.id === id)
  if (!asset) return { ok: false, message: 'That image is already gone.' }
  const used = await findUsage(`/media/${asset.file}`, doc)
  if (used.length) return { ok: false, message: `Still used by ${used.join(', ')}. Replace it there first.` }
  const d = await updateDraft((x) => ({ ...x, media: x.media.filter((m) => m.id !== id) }))
  // the published site may still show it until the next publish, so only remove files no live page uses
  const live = await import('@/lib/store/file-store').then((m) => m.readPublished())
  if (!(await findUsage(`/media/${asset.file}`, live)).length) await removeImage(asset.file)
  await audit(s.email, 'media_delete', asset.file)
  return { ok: true, message: 'Image deleted.', rev: d.rev }
}
