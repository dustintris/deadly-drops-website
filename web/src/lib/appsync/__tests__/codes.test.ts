import { createHash, createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CODE_ALPHABET,
  cleanAppVersion,
  cleanText,
  codeSecretReady,
  DesktopSetupError,
  hashActivationCode,
  newActivationCode,
  newInstallKey,
  normalizeActivationCode,
  sameHex,
} from '../codes'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('activation codes', () => {
  const CODE = 'DDP-7K3M-Q9TX-4WZ8'

  it('look like DDP-XXXX-XXXX-XXXX (60 bits), from the Crockford alphabet only (no I, L, O or U)', () => {
    expect(CODE_ALPHABET).toHaveLength(32)
    expect(CODE_ALPHABET).not.toMatch(/[ILOU]/)
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const code = newActivationCode()
      expect(code).toMatch(/^DDP(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
      seen.add(code)
    }
    expect(seen.size).toBe(500)
  })

  it('reads a code however it is typed: any case, without dashes or spaces, with or without DDP', () => {
    for (const typed of [
      CODE,
      'ddp-7k3m-q9tx-4wz8',
      'DDP7K3MQ9TX4WZ8',
      ' ddp 7k3m q9tx 4wz8 ',
      '7K3M-Q9TX-4WZ8',
      '7k3mq9tx4wz8',
      'DDP–7K3M–Q9TX–4WZ8', // en dashes
      'DDP—7K3M—Q9TX—4WZ8', // em dashes
    ]) {
      expect(normalizeActivationCode(typed), typed).toBe(CODE)
    }
    // letters that look like digits are read as the digits (Crockford)
    expect(normalizeActivationCode('DDP-7K3M-Q9TX-4WZO')).toBe('DDP-7K3M-Q9TX-4WZ0')
    expect(normalizeActivationCode('ddp-ik3m-lqtx-4wz8')).toBe('DDP-1K3M-1QTX-4WZ8')
    // a body that happens to start with DDP keeps it
    expect(normalizeActivationCode('DDPK-3MQ9-TX4W')).toBe('DDP-DDPK-3MQ9-TX4W')
  })

  it('refuses what cannot be a code, including the old 8-character length', () => {
    for (const bad of ['', 'DDP-7K3M-Q9TX', '7K3MQ9TX', 'DDP-7K3M-Q9TX-4WZ', 'DDP-7K3M-Q9TX-4WZ88', 'DDP-7K3M-Q9TX-4WZU', 'XYZ-7K3M-Q9TX-4WZ8', 'DDP-7K3M-Q9TX-4WZ!', 'x'.repeat(65)]) {
      expect(normalizeActivationCode(bad), bad).toBeNull()
    }
    expect(normalizeActivationCode(123456789012)).toBeNull()
    expect(normalizeActivationCode(null)).toBeNull()
  })

  it('are stored as an HMAC with the server secret, not a plain hash', () => {
    vi.stubEnv('DESKTOP_CODE_SECRET', 'a'.repeat(64))
    const h = hashActivationCode(CODE)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).toBe(createHmac('sha256', 'a'.repeat(64)).update(CODE).digest('hex'))
    expect(h).not.toBe(createHash('sha256').update(CODE).digest('hex'))
    vi.stubEnv('DESKTOP_CODE_SECRET', 'b'.repeat(64))
    expect(hashActivationCode(CODE)).not.toBe(h)
  })

  it('need the secret in production (no silent fallback), and use a fixed one elsewhere', () => {
    vi.stubEnv('DESKTOP_CODE_SECRET', '')
    expect(codeSecretReady()).toBe(true)
    const dev = hashActivationCode(CODE)
    expect(hashActivationCode(CODE)).toBe(dev)

    vi.stubEnv('NODE_ENV', 'production')
    expect(codeSecretReady()).toBe(false)
    expect(() => hashActivationCode(CODE)).toThrow(DesktopSetupError)
    vi.stubEnv('DESKTOP_CODE_SECRET', 'abc123') // too short
    expect(() => hashActivationCode(CODE)).toThrow(DesktopSetupError)
    vi.stubEnv('DESKTOP_CODE_SECRET', 'not hex at all, but long enough to pass a length test')
    expect(codeSecretReady()).toBe(false)
    vi.stubEnv('DESKTOP_CODE_SECRET', 'f'.repeat(32))
    expect(codeSecretReady()).toBe(true)
    expect(hashActivationCode(CODE)).not.toBe(dev)
  })
})

describe('install keys and input', () => {
  it('makes 43-character random keys', () => {
    const a = newInstallKey()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(newInstallKey()).not.toBe(a)
  })

  it('compares hashes in constant time, refusing empty or different lengths', () => {
    expect(sameHex('ab12', 'ab12')).toBe(true)
    expect(sameHex('ab12', 'ab13')).toBe(false)
    expect(sameHex('ab12', 'ab1234')).toBe(false)
    expect(sameHex('', '')).toBe(false)
  })

  it('accepts app versions and refuses anything else', () => {
    expect(cleanAppVersion('0.7.0')).toBe('0.7.0')
    expect(cleanAppVersion('1.2.0-beta.1')).toBe('1.2.0-beta.1')
    expect(cleanAppVersion('v1.0')).toBeNull()
    expect(cleanAppVersion('1'.repeat(33))).toBeNull()
    expect(cleanAppVersion('1.0 <script>')).toBeNull()
    expect(cleanAppVersion(null)).toBeNull()
  })

  it('tidies free text: invisible characters dropped, spaces collapsed, cut to length', () => {
    expect(cleanText('  Front\u0000 desk\u202e  laptop\n ', 60)).toBe('Front desk laptop')
    expect(Array.from(cleanText('😀'.repeat(100), 80))).toHaveLength(80)
    expect(cleanText('a'.repeat(79) + ' b', 80)).toBe('a'.repeat(79))
  })
})
