import 'server-only'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * The published desktop installer. The release pipeline puts `latest.yml` (electron-builder's update feed), the
 * installer and its blockmap into `${DOWNLOADS_DIR}/desktop/`; Caddy serves that folder at /downloads/desktop/ to
 * signed-in staff and activated computers only (it asks GET /api/desktop/download-check/ first).
 */

export const DOWNLOAD_PREFIX = '/downloads/desktop/'

export type DesktopRelease = {
  version: string
  /** The installer's file name in the folder, when latest.yml names a safe one. */
  file: string | null
  sizeBytes: number | null
  releaseDate: string | null
  /** Whether that installer is actually in the folder. */
  onDisk: boolean
}

type LatestYml = { version: string | null; path: string | null; firstUrl: string | null; firstSize: number | null; releaseDate: string | null }

const unquote = (v: string) => v.trim().replace(/^(['"])(.*)\1$/, '$2').trim()

/** The few fields the site needs from electron-builder's latest.yml (a flat file; no YAML library needed). */
export function parseLatestYml(text: string): LatestYml {
  const out: LatestYml = { version: null, path: null, firstUrl: null, firstSize: null, releaseDate: null }
  let inFiles = false
  let item = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const top = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (top) {
      const [, k, v] = top
      inFiles = k === 'files'
      if (k === 'version') out.version = unquote(v) || null
      else if (k === 'path') out.path = unquote(v) || null
      else if (k === 'releaseDate') out.releaseDate = unquote(v) || null
      continue
    }
    if (!inFiles) continue
    // "  - url: x" / "    size: 1" (an item may also start at column 0: "- url: x")
    const entry = line.match(/^\s*(-\s+)?([A-Za-z][\w-]*):\s*(.*)$/)
    if (!entry) continue
    if (entry[1]) item++
    if (item !== 1) continue
    if (entry[2] === 'url') out.firstUrl = unquote(entry[3]) || null
    else if (entry[2] === 'size' && /^\d{1,12}$/.test(unquote(entry[3]))) out.firstSize = Number(unquote(entry[3]))
  }
  return out
}

/** A plain file name in that folder: no folders, no leading dot, nothing a URL or path could bend. */
export const safeFileName = (f: string | null): f is string =>
  !!f && f.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9._ +()-]*$/.test(f) && !f.includes('..')

const cleanVersion = (v: string | null) => (v && /^[0-9][0-9A-Za-z.+-]{0,31}$/.test(v) ? v : null)

function desktopDir(): string | null {
  const dir = process.env.DOWNLOADS_DIR?.trim()
  return dir ? path.join(path.resolve(/*turbopackIgnore: true*/ dir), 'desktop') : null
}

async function readYml(): Promise<{ dir: string; yml: LatestYml } | null> {
  const dir = desktopDir()
  if (!dir) return null
  try {
    const text = await readFile(path.join(/*turbopackIgnore: true*/ dir, 'latest.yml'), 'utf8')
    return text.length > 64_000 ? null : { dir, yml: parseLatestYml(text) }
  } catch {
    return null
  }
}

/** The version the update feed offers, or null (no DOWNLOADS_DIR, no latest.yml, or it can't be read). */
export async function readLatestVersion(): Promise<string | null> {
  return cleanVersion((await readYml())?.yml.version ?? null)
}

/** The published installer for the admin's download link, or null when nothing has been published. */
export async function readLatestRelease(): Promise<DesktopRelease | null> {
  const found = await readYml()
  const version = cleanVersion(found?.yml.version ?? null)
  if (!found || !version) return null
  const named = found.yml.path ?? found.yml.firstUrl
  const file = safeFileName(named) ? named : null
  let sizeBytes = found.yml.firstSize
  let onDisk = false
  if (file) {
    try {
      const s = await stat(path.join(/*turbopackIgnore: true*/ found.dir, file))
      onDisk = s.isFile()
      if (onDisk) sizeBytes = s.size
    } catch {
      onDisk = false
    }
  }
  const releaseDate = found.yml.releaseDate && !Number.isNaN(Date.parse(found.yml.releaseDate)) ? new Date(found.yml.releaseDate).toISOString() : null
  return { version, file, sizeBytes, releaseDate, onDisk }
}

/**
 * Whether a forwarded request (X-Forwarded-Uri from Caddy) is for the desktop downloads: the path, without its query
 * and decoded, must be under /downloads/desktop/ with no "." or ".." segments, backslashes or NUL.
 */
export function downloadPathAllowed(uri: string | null): boolean {
  if (!uri || uri.length > 2048) return false
  const raw = uri.split(/[?#]/, 1)[0]
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return false
  }
  if (!decoded.startsWith(DOWNLOAD_PREFIX) || /[\\\0]/.test(decoded)) return false
  return !decoded.split('/').some((seg) => seg === '.' || seg === '..')
}
