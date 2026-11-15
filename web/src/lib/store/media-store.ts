import 'server-only'
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './file-store'

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
  await fs.mkdir(UPLOADS, { recursive: true })
  await fs.writeFile(full, buf, { flag: 'wx' })
  return { id, file }
}

export async function removeImage(file: string) {
  const full = uploadPath(file)
  if (full) await fs.rm(full, { force: true })
}
