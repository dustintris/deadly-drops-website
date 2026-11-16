import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { buildSeed } from '@/content/seed'
import { getDb, type Db } from '@/db/client'
import { siteDocuments, siteHistory } from '@/db/schema'
import { sameContent, sectionHash, type SiteContent } from '@/lib/content-schema'

/**
 * Website content store on PostgreSQL.
 *   site_documents 'draft'      working copy the MIS edits
 *   site_documents 'published'  what the public site shows
 *   site_history                the last 20 published versions
 * Every write runs in one transaction holding an advisory lock, so writers take
 * turns and a section save can't overwrite a change it never saw.
 */

const KEEP_HISTORY = 20
/** Advisory lock id shared by every content write ("ddp-content"). */
const CONTENT_LOCK = 0x0dd9_c0de

type DocKey = 'draft' | 'published'
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Executor = Db | Tx

export class StaleRevisionError extends Error {
  constructor() {
    super('This was changed somewhere else (another tab?). Reload the page and try again.')
  }
}

/**
 * Content saved by an older version may lack newer sections or settings fields: fill them from the seed,
 * so pages and editors always get a complete document.
 */
function normalize(doc: Partial<SiteContent>): SiteContent {
  const seed = buildSeed()
  const out = { ...seed, ...doc } as SiteContent
  for (const k of Object.keys(seed) as (keyof SiteContent)[]) {
    if (out[k] === undefined || out[k] === null) (out as Record<string, unknown>)[k] = seed[k]
  }
  out.settings = { ...seed.settings, ...doc.settings } as SiteContent['settings']
  out.pages = { ...seed.pages, ...doc.pages }
  return out
}

async function readDoc(db: Executor, key: DocKey): Promise<SiteContent | null> {
  const [row] = await db.select({ data: siteDocuments.data }).from(siteDocuments).where(eq(siteDocuments.key, key)).limit(1)
  return row ? normalize(row.data) : null
}

/** jsonb cannot store the NUL character; drop it (it only ever arrives in pasted text). */
const withoutNul = (doc: SiteContent): SiteContent =>
  JSON.stringify(doc).includes('\\u0000') ? (JSON.parse(JSON.stringify(doc).replaceAll('\\u0000', '')) as SiteContent) : doc

async function writeDoc(tx: Tx, key: DocKey, doc: SiteContent): Promise<void> {
  const data = withoutNul(doc)
  const updatedAt = new Date()
  await tx
    .insert(siteDocuments)
    .values({ key, data, updatedAt })
    .onConflictDoUpdate({ target: siteDocuments.key, set: { data, updatedAt } })
}

/**
 * Run a content write in a transaction that holds the content lock until commit.
 * Timeouts stop a stuck writer from holding pool connections the public site needs.
 */
function locked<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`)
    await tx.execute(sql`set local statement_timeout = '15s'`)
    await tx.execute(sql`select pg_advisory_xact_lock(${CONTENT_LOCK})`)
    return fn(tx)
  })
}

async function draftOf(db: Executor): Promise<SiteContent> {
  return (await readDoc(db, 'draft')) ?? (await readDoc(db, 'published')) ?? buildSeed()
}

export async function readPublished(): Promise<SiteContent> {
  return (await readDoc(getDb(), 'published')) ?? buildSeed()
}

export async function readDraft(): Promise<SiteContent> {
  return draftOf(getDb())
}

/** Replace one section of the draft, unless someone changed that section since the editor loaded it. */
export function saveDraftSection<K extends keyof SiteContent>(key: K, value: SiteContent[K], baseHash: string): Promise<SiteContent> {
  return locked(async (tx) => {
    const draft = await draftOf(tx)
    if (sectionHash(draft[key]) !== baseHash) throw new StaleRevisionError()
    const next: SiteContent = { ...draft, [key]: value, rev: draft.rev + 1, updatedAt: new Date().toISOString() }
    await writeDoc(tx, 'draft', next)
    return next
  })
}

/** Apply a change to the draft without a revision check (used by uploads and media edits). */
export function updateDraft(fn: (d: SiteContent) => SiteContent): Promise<SiteContent> {
  return locked(async (tx) => {
    const draft = await draftOf(tx)
    const next = { ...fn(draft), rev: draft.rev + 1, updatedAt: new Date().toISOString() }
    await writeDoc(tx, 'draft', next)
    return next
  })
}

/** Every part of the content that can be published or discarded on its own (media = the photo library). */
export const CONTENT_KEYS = ['settings', 'theme', 'ticker', 'products', 'media', 'gallery', 'posts', 'faqs', 'pages'] as const
export type ContentKey = (typeof CONTENT_KEYS)[number]

/**
 * Put these sections of the draft live; the rest of the live site is untouched (someone without
 * access to a section can't publish another person's draft of it). The previous live copy goes
 * to history (last 20 kept).
 */
export function publishSections(keys: readonly ContentKey[]): Promise<SiteContent> {
  return locked(async (tx) => {
    const draft = await draftOf(tx)
    const current = await readDoc(tx, 'published')
    if (current) {
      await tx.insert(siteHistory).values({ data: current })
      await tx.execute(sql`
        delete from ${siteHistory}
        where ${siteHistory.id} not in (
          select ${siteHistory.id} from ${siteHistory} order by ${siteHistory.id} desc limit ${KEEP_HISTORY}
        )`)
    }
    const live: SiteContent = { ...(current ?? buildSeed()), rev: draft.rev, updatedAt: new Date().toISOString() }
    for (const k of keys) (live as Record<ContentKey, unknown>)[k] = draft[k]
    await writeDoc(tx, 'published', live)
    return live
  })
}

/** Put the whole draft live. */
export const publish = () => publishSections(CONTENT_KEYS)

/** Throw away unpublished changes to these sections: they go back to the live copy. */
export function discardSections(keys: readonly ContentKey[]): Promise<SiteContent> {
  return locked(async (tx) => {
    const live = (await readDoc(tx, 'published')) ?? buildSeed()
    const draft = await draftOf(tx)
    const next: SiteContent = { ...draft, rev: draft.rev + 1, updatedAt: new Date().toISOString() }
    for (const k of keys) (next as Record<ContentKey, unknown>)[k] = live[k]
    await writeDoc(tx, 'draft', next)
    return next
  })
}

/** Throw away every unpublished change. */
export const discardDraft = () => discardSections(CONTENT_KEYS)

/** Which sections differ between draft and live. */
export async function unpublishedSections(): Promise<ContentKey[]> {
  const [d, p] = await Promise.all([readDraft(), readPublished()])
  return CONTENT_KEYS.filter((k) => !sameContent(d[k], p[k]))
}
