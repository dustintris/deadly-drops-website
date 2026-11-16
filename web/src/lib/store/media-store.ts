import 'server-only'
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './paths'

/** Uploaded images live outside /public, under data/uploads, and are served by /media/[file]. */
export const UPLOADS = path.join(DATA_DIR, 'uploads')
export const MEDIA_FILE = /^[a-f0-9]{24}\.(jpg|png|webp)$/
export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_SIDE = 6000

export type Sniffed = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp'; width: number; height: number }

/** Decide the type from the file's bytes (never from its name or the browser's claim) and read its size. */
export function sniffImage(buf: Buffer): Sniffed | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return { mime: 'image/png', ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16)
    if (chunk === 'VP8X') return { mime: 'image/webp', ext: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
    if (chunk === 'VP8 ') return { mime: 'image/webp', ext: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21)
      return { mime: 'image/webp', ext: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
    }
    return null
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      // SOF0-SOF15 except DHT/JPG/DAC carry the frame size
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', ext: 'jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
      }
      i += 2 + len
    }
    return null
  }
  return null
}

/**
 * Remove metadata that can identify people or places (EXIF incl. GPS, XMP, IPTC, comments, text chunks)
 * without re-encoding the picture. Returns null if the file structure is not what we expect.
 */
export function stripMetadata(buf: Buffer, s: Sniffed): Buffer | null {
  if (s.mime === 'image/jpeg') {
    const out: Buffer[] = [buf.subarray(0, 2)]
    let i = 2
    while (i + 4 <= buf.length) {
      if (buf[i] !== 0xff) return null
      const marker = buf[i + 1]
      if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out) } // start of scan: image data follows
      const len = buf.readUInt16BE(i + 2)
      if (len < 2 || i + 2 + len > buf.length) return null
      // drop APP1 (EXIF/XMP), APP13 (IPTC) and comments; keep JFIF, ICC colour profile and the rest
      if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) out.push(buf.subarray(i, i + 2 + len))
      i += 2 + len
    }
    return null
  }
  if (s.mime === 'image/png') {
    const out: Buffer[] = [buf.subarray(0, 8)]
    let i = 8
    while (i + 12 <= buf.length) {
      const len = buf.readUInt32BE(i)
      const type = buf.toString('ascii', i + 4, i + 8)
      const end = i + 12 + len
      if (end > buf.length) return null
      if (!['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'].includes(type)) out.push(buf.subarray(i, end))
      i = end
      if (type === 'IEND') return Buffer.concat(out)
    }
    return null
  }
  // WebP: drop EXIF and XMP chunks and clear their flags in the VP8X header
  const out: Buffer[] = []
  let i = 12
  while (i + 8 <= buf.length) {
    const type = buf.toString('ascii', i, i + 4)
    const len = buf.readUInt32LE(i + 4)
    const end = i + 8 + len + (len % 2)
    if (end > buf.length + 1) return null
    const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)))
    if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~0x0c
    if (type !== 'EXIF' && type !== 'XMP ') out.push(chunk)
    i = end
  }
  const body = Buffer.concat(out)
  const head = Buffer.alloc(12)
  head.write('RIFF', 0, 'ascii')
  head.writeUInt32LE(body.length + 4, 4)
  head.write('WEBP', 8, 'ascii')
  return Buffer.concat([head, body])
}

/** Resolve a stored file name safely: only our own generated names, only inside UPLOADS. */
export function uploadPath(file: string): string | null {
  if (!MEDIA_FILE.test(file)) return null
  const full = path.resolve(UPLOADS, file)
  return full.startsWith(UPLOADS + path.sep) ? full : null
}

export async function putImage(buf: Buffer, s: Sniffed): Promise<{ id: string; file: string }> {
  const id = randomBytes(12).toString('hex')
  const file = `${id}.${s.ext}`
  const full = uploadPath(file)
  if (!full) throw new Error('bad file name')
  await fs.mkdir(UPLOADS, { recursive: true, mode: 0o700 })
  await fs.writeFile(full, buf, { flag: 'wx' })
  return { id, file }
}

export async function removeImage(file: string) {
  const full = uploadPath(file)
  if (full) await fs.rm(full, { force: true })
}
