import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed } from '@/content/seed'
import { getSql } from '@/db/client'
import { sectionHash } from '@/lib/content-schema'
import {
  discardDraft,
  publish,
  readDraft,
  readPublished,
  saveDraftSection,
  StaleRevisionError,
  unpublishedSections,
  updateDraft,
} from '../content-store'

const sql = () => getSql()

beforeEach(async () => {
  await sql()`truncate site_documents, site_history`
})

describe('content store (PostgreSQL)', () => {
  it('serves the seed when nothing has been saved yet', async () => {
    const live = await readPublished()
    expect(live.settings.name).toBe(buildSeed().settings.name)
    expect(await readDraft()).toEqual(live)
  })

  it('saves a section to the draft only, as a real jsonb document', async () => {
    const draft = await readDraft()
    const ticker = [...draft.ticker, { id: 'tick-test', text: 'Courts open at 8' }] as typeof draft.ticker

    const next = await saveDraftSection('ticker', ticker, sectionHash(draft.ticker))

    expect(next.rev).toBe(draft.rev + 1)
    expect((await readDraft()).ticker).toEqual(ticker)
    expect((await readPublished()).ticker).toEqual(buildSeed().ticker)
    const [row] = await sql()`select jsonb_typeof(data) as kind from site_documents where key = 'draft'`
    expect(row.kind).toBe('object')
  })

  it('accepts a second save based on the hash the first save returned (editor flow)', async () => {
    // The MIS keeps the hash of what it sent; the database hands back jsonb with its own key order.
    const draft = await readDraft()
    const settings = { ...draft.settings, tagline: 'Dink responsibly' }
    const first = await saveDraftSection('settings', settings, sectionHash(draft.settings))

    const again = { ...settings, tagline: 'Dink often' }
    await expect(saveDraftSection('settings', again, sectionHash(first.settings))).resolves.toMatchObject({ rev: first.rev + 1 })
  })

  it('drops NUL characters (pasted text) that jsonb cannot store', async () => {
    const draft = await readDraft()
    const settings = { ...draft.settings, tagline: 'Dink\u0000 often' }
    await saveDraftSection('settings', settings, sectionHash(draft.settings))
    expect((await readDraft()).settings.tagline).toBe('Dink often')
  })

  it('rejects a save based on an out-of-date copy of the section', async () => {
    const draft = await readDraft()
    await saveDraftSection('faqs', [], sectionHash(draft.faqs))

    await expect(saveDraftSection('faqs', draft.faqs, sectionHash(draft.faqs))).rejects.toBeInstanceOf(StaleRevisionError)
  })

  it('lets exactly one of two simultaneous saves from the same copy win', async () => {
    const draft = await readDraft()
    const base = sectionHash(draft.faqs)

    const results = await Promise.allSettled([
      saveDraftSection('faqs', [], base),
      saveDraftSection('faqs', [], base),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(StaleRevisionError)
  })

  it('applies an unconditional draft update', async () => {
    const before = await readDraft()
    const next = await updateDraft((d) => ({ ...d, media: [] }))
    expect(next.rev).toBe(before.rev + 1)
    expect((await readDraft()).media).toEqual([])
  })

  it('lists the sections that differ from the live site', async () => {
    expect(await unpublishedSections()).toEqual([])
    const draft = await readDraft()
    await saveDraftSection('faqs', [], sectionHash(draft.faqs))
    expect(await unpublishedSections()).toEqual(['faqs'])
  })

  it('publishes the draft and keeps the previous live copy in history', async () => {
    const draft = await readDraft()
    await saveDraftSection('faqs', [], sectionHash(draft.faqs))
    await publish() // first publish: nothing live yet, so no history

    const d2 = await readDraft()
    await saveDraftSection('ticker', [], sectionHash(d2.ticker))
    const live = await publish()

    expect(live.ticker).toEqual([])
    expect((await readPublished()).ticker).toEqual([])
    expect(await unpublishedSections()).toEqual([])
    const history = await sql()`select data from site_history order by id`
    expect(history).toHaveLength(1)
    expect(history[0].data.faqs).toEqual([])
    expect(history[0].data.ticker).toEqual(buildSeed().ticker)
  })

  it('keeps only the last 20 published versions', async () => {
    for (let i = 0; i < 23; i++) await publish()
    const [{ count }] = await sql()`select count(*)::int as count from site_history`
    expect(count).toBe(20)
  })

  it('discards draft changes back to the live copy', async () => {
    const draft = await readDraft()
    await saveDraftSection('faqs', [], sectionHash(draft.faqs))

    const reset = await discardDraft()

    expect(reset.faqs).toEqual((await readPublished()).faqs)
    expect(reset.rev).toBe(draft.rev + 2)
    expect(await unpublishedSections()).toEqual([])
  })
})
