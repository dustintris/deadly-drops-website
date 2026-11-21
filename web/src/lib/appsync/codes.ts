import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Activation codes and install keys for the desktop app.
 * - A code (DDP-7K3M-Q9TX-4WZ8) is 12 Crockford base32 characters: 60 random bits, no I, L, O or U, so it can be read
 *   aloud or copied by hand. It is stored as HMAC-SHA256(DESKTOP_CODE_SECRET, code), so a copy of the database
 *   alone can't be searched for unused codes.
 * - An install key is 32 random bytes (base64url, 43 characters), stored as its SHA-256.
 */

export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Used only outside production, so a laptop or the tests need no setup. Never valid in production. */
const DEV_SECRET = 'ddp-development-only-desktop-code-secret'

export class DesktopSetupError extends Error {
  constructor() {
    super('Activation isn’t set up on the server yet (DESKTOP_CODE_SECRET).')
  }
}

/** Read at call time (never at import), so the server reads its environment when it runs. */
function codeSecret(): string {
  const s = process.env.DESKTOP_CODE_SECRET?.trim() ?? ''
  if (/^[0-9a-f]{32,}$/i.test(s)) return s
  if (process.env.NODE_ENV === 'production') throw new DesktopSetupError()
  return DEV_SECRET
}

/** Whether codes can be made and used on this server. */
export function codeSecretReady(): boolean {
  try {
    codeSecret()
    return true
  } catch {
    return false
  }
}

/** The stored form of a normalised code (DDP-XXXX-XXXX-XXXX). Throws DesktopSetupError when the secret is missing. */
export function hashActivationCode(normalised: string): string {
  return createHmac('sha256', codeSecret()).update(normalised, 'utf8').digest('hex')
}

export const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

/** Two hex hashes compared in constant time. */
export function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y)
}

const CODE_CHARS = 12
const written = (body: string) => `DDP-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`

/** A new code, e.g. DDP-7K3M-Q9TX-4WZ8. 256 is a multiple of 32, so every character is equally likely. */
export function newActivationCode(): string {
  let body = ''
  for (const b of randomBytes(CODE_CHARS)) body += CODE_ALPHABET[b & 31]
  return written(body)
}

/**
 * What someone typed, in its one written form (DDP-XXXX-XXXX-XXXX), or null when it can't be a code. Any case;
 * spaces and dashes are ignored; the DDP prefix may be left off; O is read as 0 and I or L as 1 (Crockford's rule).
 * Any other length is refused.
 */
export function normalizeActivationCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 64) return null
  let s = input.toUpperCase().replace(/[\s_\-‐-―−]/g, '')
  if (s.length === CODE_CHARS + 3 && s.startsWith('DDP')) s = s.slice(3)
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1')
  if (!/^[0-9A-HJKMNP-TV-Z]{12}$/.test(s)) return null
  return written(s)
}

/** A new install key: shown to the app once, stored as its SHA-256. */
export const newInstallKey = () => randomBytes(32).toString('base64url')

/** A version the app reports ("0.7.0", "1.2.0-beta.1"), or null when it isn't one. */
export function cleanAppVersion(v: unknown): string | null {
  return typeof v === 'string' && /^[0-9][0-9A-Za-z.+-]{0,31}$/.test(v) ? v : null
}

/**
 * Free text from outside (a label, a computer's name): control and invisible direction characters dropped, spaces
 * collapsed, trimmed, and cut to `max` characters (counted as the database counts them).
 */
export function cleanText(v: string, max: number): string {
  const s = v
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(s).slice(0, max).join('').trim()
}
