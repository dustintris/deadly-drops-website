import 'server-only'
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { sectionHash, type SiteContent } from '@/lib/content-schema'
import { buildSeed } from '@/content/seed'

/**
 * JSON-file content store for a single server with a persistent disk.
 * data/content/draft.json      working copy the MIS edits
 * data/content/published.json  what the public site shows
 * data/content/history/*.json  the last 20 published versions (for undo)
 * Swap this module for a database adapter (same functions) on serverless hosts.
 */
// runtime data folder, not part of the build output
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.CONTENT_DIR || path.join(process.cwd(), 'data'))
const CONTENT = path.join(DATA_DIR, 'content')
const DRAFT = path.join(CONTENT, 'draft.json')
const PUBLISHED = path.join(CONTENT, 'published.json')
const HISTORY = path.join(CONTENT, 'history')
const KEEP_HISTORY = 20

export class StaleRevisionError extends Error {
  constructor() { super('This was changed somewhere else (another tab?). Reload the page and try again.') }
}

/**
 * Content saved by an older version may lack newer sections or settings fields: fill them from the seed,
 * so pages and editors always get a complete document.
 */
function normalize(doc: Partial<SiteContent>): SiteContent {
  const seed = buildSeed()
  const out = { ...seed, ...doc } as SiteContent
  for (const k of Object.keys(seed) as (keyof SiteContent)[]) if (out[k] === undefined || out[k] === null) (out as Record<string, unknown>)[k] = seed[k]
  out.settings = { ...seed.settings, ...doc.settings } as SiteContent['settings']
  out.pages = { ...seed.pages, ...doc.pages }
  return out
}

async function readJson(file: string): Promise<SiteContent | null> {
  try {
    return normalize(JSON.parse(await fs.readFile(file, 'utf8')) as Partial<SiteContent>)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

/** Write to a temp file, flush, then rename: a crash never leaves half a file. */
async function writeJsonAtomic(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`
  const handle = await fs.open(tmp, 'w', 0o600)
  try {
    await handle.writeFile(JSON.stringify(data, null, 1))
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, file)
}

/* one writer at a time inside this process */
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}

export async function readPublished(): Promise<SiteContent> {
  return (await readJson(PUBLISHED)) ?? buildSeed()
}

export async function readDraft(): Promise<SiteContent> {
  return (await readJson(DRAFT)) ?? (await readPublished())
}

/** Replace one section of the draft, unless someone changed that section since the editor loaded it. */
export function saveDraftSection<K extends keyof SiteContent>(key: K, value: SiteContent[K], baseHash: string): Promise<SiteContent> {
  return exclusive(async () => {
    const draft = await readDraft()
    if (sectionHash(draft[key]) !== baseHash) throw new StaleRevisionError()
    const next: SiteContent = { ...draft, [key]: value, rev: draft.rev + 1, updatedAt: new Date().toISOString() }
    await writeJsonAtomic(DRAFT, next)
    return next
  })
}

/** Apply a change to the draft without a revision check (used by uploads). */
export function updateDraft(fn: (d: SiteContent) => SiteContent): Promise<SiteContent> {
  return exclusive(async () => {
    const draft = await readDraft()
    const next = { ...fn(draft), rev: draft.rev + 1, updatedAt: new Date().toISOString() }
    await writeJsonAtomic(DRAFT, next)
    return next
  })
}

export function publish(): Promise<SiteContent> {
  return exclusive(async () => {
    const draft = await readDraft()
    const current = await readJson(PUBLISHED)
    if (current) {
      await writeJsonAtomic(path.join(HISTORY, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`), current)
      const old = (await fs.readdir(HISTORY)).filter((f) => f.endsWith('.json')).sort()
      for (const f of old.slice(0, Math.max(0, old.length - KEEP_HISTORY))) await fs.unlink(path.join(HISTORY, f))
    }
    const live = { ...draft, updatedAt: new Date().toISOString() }
    await writeJsonAtomic(PUBLISHED, live)
    await writeJsonAtomic(DRAFT, live)
    return live
  })
}

export function discardDraft(): Promise<SiteContent> {
  return exclusive(async () => {
    const live = await readPublished()
    const draft = await readDraft()
    const next = { ...live, rev: draft.rev + 1 }
    await writeJsonAtomic(DRAFT, next)
    return next
  })
}

/** Which sections differ between draft and live. */
export async function unpublishedSections(): Promise<string[]> {
  const [d, p] = await Promise.all([readDraft(), readPublished()])
  const keys = ['settings', 'theme', 'events', 'ticker', 'products', 'media', 'gallery', 'posts', 'faqs', 'pages'] as const
  return keys.filter((k) => JSON.stringify(d[k]) !== JSON.stringify(p[k]))
}
