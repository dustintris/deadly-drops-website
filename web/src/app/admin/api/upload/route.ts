import { NextResponse } from 'next/server'
import { audit } from '@/lib/audit'
import { can, type Area } from '@/lib/auth/permissions'
import { allowAction } from '@/lib/auth/rate-limit'
import { getSession } from '@/lib/auth/session'
import { MediaAsset } from '@/lib/content-schema'
import { isSameOrigin } from '@/lib/security'
import { readDraft, updateDraft } from '@/lib/store/content-store'
import { MAX_BYTES, MAX_SIDE, putImage, sniffImage, stripMetadata } from '@/lib/store/media-store'

export const runtime = 'nodejs'

/**
 * POST multipart/form-data { file, alt } → adds the image to the media library (draft).
 * Checks: signed-in admin, same origin, ≤ 5 MB (while reading), real JPEG/PNG/WebP by magic bytes,
 * ≤ 6000 px a side. The stored name is random; the browser's file name is never used.
 */
/** Screens with an image picker: editing any of them allows adding photos to the library. */
const UPLOAD_AREAS: Area[] = ['content', 'shop', 'tournaments', 'branding']
const MAX_UPLOADS_PER_HOUR = 120
const MAX_LIBRARY = 1500

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, message: 'Sign in again.' }, { status: 401 })
  if (!UPLOAD_AREAS.some((a) => can(session, a, 'edit'))) {
    return NextResponse.json({ ok: false, message: 'Your login can’t add photos.' }, { status: 403 })
  }
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, message: 'Request blocked.' }, { status: 403 })
  // keep one login (or a stolen session) from filling the disk
  if (!allowAction(`upload:${session.id}`, MAX_UPLOADS_PER_HOUR, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, message: `That’s ${MAX_UPLOADS_PER_HOUR} photos in the last hour. Try again later.` }, { status: 429 })
  }
  if ((await readDraft()).media.length >= MAX_LIBRARY) {
    return NextResponse.json({ ok: false, message: `The photo library is full (${MAX_LIBRARY}). Delete unused photos first.` }, { status: 413 })
  }
  // the size must be declared up front, so nothing large is read into memory before the check
  const declared = Number(req.headers.get('content-length'))
  if (!declared) return NextResponse.json({ ok: false, message: 'Upload size missing. Try again.' }, { status: 411 })
  if (declared > MAX_BYTES + 64 * 1024) return NextResponse.json({ ok: false, message: 'Images can be at most 5 MB.' }, { status: 413 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, message: 'Could not read the upload.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: 'Choose an image to upload.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, message: 'Images can be at most 5 MB.' }, { status: 413 })

  const raw = Buffer.from(await file.arrayBuffer())
  const kind = sniffImage(raw)
  if (!kind) {
    return NextResponse.json({ ok: false, message: 'Use a JPEG, PNG or WebP photo. iPhone HEIC photos: set the camera to "Most Compatible" or export as JPEG.' }, { status: 415 })
  }
  if (kind.width > MAX_SIDE || kind.height > MAX_SIDE || kind.width < 1 || kind.height < 1) {
    return NextResponse.json({ ok: false, message: 'That image is too large. Keep each side under 6000 pixels.' }, { status: 413 })
  }

  // drop location and camera data before anything is stored or shown
  const buf = stripMetadata(raw, kind)
  if (!buf) return NextResponse.json({ ok: false, message: 'That file looks damaged. Export it again and retry.' }, { status: 415 })
  const { id, file: name } = await putImage(buf, kind)
  const asset = MediaAsset.parse({
    id, file: name, mime: kind.mime, width: kind.width, height: kind.height, bytes: buf.length,
    alt: String(form.get('alt') ?? '').slice(0, 160), uploadedAt: new Date().toISOString(),
  })
  const doc = await updateDraft((d) => ({ ...d, media: [asset, ...d.media] }))
  await audit(session.email, 'upload', name)
  return NextResponse.json({ ok: true, asset, src: `/media/${name}`, rev: doc.rev })
}
