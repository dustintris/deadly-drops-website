import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { downloadPathAllowed, parseLatestYml, readLatestRelease, readLatestVersion, safeFileName } from '../release'

// what electron-builder writes next to the installer
const LATEST = `version: 0.7.0
files:
  - url: DeadlyDropsPickleball-Setup-0.7.0.exe
    sha512: c2hhNTEy
    size: 91234567
path: DeadlyDropsPickleball-Setup-0.7.0.exe
sha512: c2hhNTEy
releaseDate: '2026-11-21T10:00:00.000Z'
`

let root = ''
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'ddp-downloads-'))
})
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})
afterEach(() => {
  vi.unstubAllEnvs()
})

async function publish(files: Record<string, string>) {
  const dir = path.join(root, `case-${Math.random().toString(36).slice(2)}`)
  await mkdir(path.join(dir, 'desktop'), { recursive: true })
  for (const [name, text] of Object.entries(files)) await writeFile(path.join(dir, 'desktop', name), text)
  vi.stubEnv('DOWNLOADS_DIR', dir)
  return dir
}

describe('the update feed (latest.yml)', () => {
  it('reads version, installer, size and date', () => {
    expect(parseLatestYml(LATEST)).toEqual({
      version: '0.7.0',
      path: 'DeadlyDropsPickleball-Setup-0.7.0.exe',
      firstUrl: 'DeadlyDropsPickleball-Setup-0.7.0.exe',
      firstSize: 91234567,
      releaseDate: '2026-11-21T10:00:00.000Z',
    })
    // quoted values, Windows line endings, an item at column 0, no path line
    const other = parseLatestYml('version: "1.0.0"\r\nfiles:\r\n- url: "Setup 1.0.0.exe"\r\n  size: 12\r\n- url: second.exe\r\n  size: 99\r\n')
    expect(other).toMatchObject({ version: '1.0.0', path: null, firstUrl: 'Setup 1.0.0.exe', firstSize: 12 })
  })

  it('accepts plain file names only', () => {
    expect(safeFileName('DeadlyDropsPickleball-Setup-0.7.0.exe')).toBe(true)
    expect(safeFileName('Deadly Drops Setup 0.7.0.exe')).toBe(true)
    for (const bad of ['../etc/passwd', 'a/b.exe', 'a\\b.exe', '.hidden.exe', 'a..b.exe', '', null, 'x'.repeat(201)]) {
      expect(safeFileName(bad), String(bad)).toBe(false)
    }
  })

  it('offers the published version and the installer that is really there', async () => {
    await publish({ 'latest.yml': LATEST, 'DeadlyDropsPickleball-Setup-0.7.0.exe': 'x'.repeat(2048) })
    expect(await readLatestVersion()).toBe('0.7.0')
    expect(await readLatestRelease()).toEqual({
      version: '0.7.0',
      file: 'DeadlyDropsPickleball-Setup-0.7.0.exe',
      sizeBytes: 2048, // the file on disk wins over the size in the feed
      releaseDate: '2026-11-21T10:00:00.000Z',
      onDisk: true,
    })
  })

  it('says when the feed names an installer that is missing or unsafe', async () => {
    await publish({ 'latest.yml': LATEST })
    expect(await readLatestRelease()).toMatchObject({ version: '0.7.0', onDisk: false, sizeBytes: 91234567 })
    await publish({ 'latest.yml': 'version: 0.7.1\npath: ../../secret.exe\n' })
    expect(await readLatestRelease()).toMatchObject({ version: '0.7.1', file: null, onDisk: false })
  })

  it('has nothing to offer without DOWNLOADS_DIR, latest.yml, or a usable version', async () => {
    vi.stubEnv('DOWNLOADS_DIR', '')
    expect(await readLatestVersion()).toBeNull()
    expect(await readLatestRelease()).toBeNull()
    vi.stubEnv('DOWNLOADS_DIR', path.join(root, 'does-not-exist'))
    expect(await readLatestVersion()).toBeNull()
    await publish({ 'latest.yml': 'version: <script>\n' })
    expect(await readLatestVersion()).toBeNull()
    expect(await readLatestRelease()).toBeNull()
  })
})

describe('which forwarded paths the download gate covers', () => {
  it('allows the desktop folder, with or without a query', () => {
    expect(downloadPathAllowed('/downloads/desktop/latest.yml')).toBe(true)
    expect(downloadPathAllowed('/downloads/desktop/latest.yml?noCache=1h2j3')).toBe(true)
    expect(downloadPathAllowed('/downloads/desktop/DeadlyDropsPickleball-Setup-0.7.0.exe.blockmap')).toBe(true)
    expect(downloadPathAllowed('/downloads/desktop/Deadly%20Drops%20Setup.exe')).toBe(true)
  })

  it('refuses anything outside it, and paths that climb out or hide tricks', () => {
    for (const bad of [
      null,
      '',
      '/',
      '/downloads/',
      '/downloads/desktopx/a.exe',
      '/downloads/other/a.exe',
      '/admin/',
      '/downloads/desktop/../../admin/',
      '/downloads/desktop/%2e%2e/secret',
      '/downloads/desktop/./latest.yml',
      '/downloads/desktop/a\\b.exe',
      '/downloads/desktop/a%5Cb.exe',
      '/downloads/desktop/a%00.exe',
      '/downloads/desktop/%E0%A4%A',
      '/x?/downloads/desktop/latest.yml',
      '%2Fdownloads%2Fdesktop%2F..%2F..%2Fetc',
    ]) {
      expect(downloadPathAllowed(bad), String(bad)).toBe(false)
    }
  })
})
