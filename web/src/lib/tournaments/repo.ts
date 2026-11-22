import 'server-only'
import { and, asc, desc, eq, inArray, ne, notInArray, or, sql } from 'drizzle-orm'
import { events as seedEvents } from '@/content/club'
import { getDb, type Db } from '@/db/client'
import { appMeta, divisions, matches, siteDocuments, teams, tournaments } from '@/db/schema'
import { slugify, type ClubEventT } from '@/lib/content-schema'
import { addDaysIso, autoDateLabel, normalizeDays } from './days'
import { DEFAULT_RULES, type DivisionFormat, type DivisionInputT, type InfoT, type RulesT, type TournamentInputT } from './schema'

/**
 * Tournaments and their divisions in PostgreSQL. Saved changes are live at once (a hidden
 * tournament is the draft). The editor saves the whole tournament with the version it loaded,
 * so a second editor can't silently overwrite the first.
 */

export type Division = DivisionInputT & { id: number; tournamentId: number; sort: number }

export type Tournament = {
  id: number
  slug: string
  name: string
  days: string[]
  info: InfoT
  rules: RulesT
  featured: boolean
  visible: boolean
  version: number
  liveVersion: number
  updatedAt: string
  divisions: Division[]
}

export class StaleTournamentError extends Error {
  constructor() {
    super('Someone saved this tournament after you opened it. Reload the page to see their changes, then make yours again.')
  }
}

export class SlugTakenError extends Error {
  constructor() {
    super('Another tournament already uses that web address.')
  }
}

export class DivisionInUseError extends Error {
  constructor(names: string[]) {
    super(`${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} teams or matches, so ${names.length === 1 ? 'it' : 'they'} can’t be removed. Clear the teams first.`)
  }
}

export class PlayoffsDrawnError extends Error {
  constructor(names: string[]) {
    super(`The playoffs for ${names.join(', ')} are already drawn. Reset them on the Play page before changing the playoff format.`)
  }
}

export class TournamentNotFoundError extends Error {
  constructor() {
    super('That tournament no longer exists.')
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Executor = Db | Tx
type TournamentRow = typeof tournaments.$inferSelect
type DivisionRow = typeof divisions.$inferSelect

const IMPORT_FLAG = 'tournaments_imported'
const IMPORT_LOCK = 0x0dd9_7001
/** Saves that feature a tournament take turns, so two can't both win the one featured slot. */
const FEATURE_LOCK = 0x0dd9_7002

const toDivision = (r: DivisionRow): Division => ({
  id: r.id,
  tournamentId: r.tournamentId,
  sort: r.sort,
  name: r.name,
  format: r.format as DivisionFormat,
  dayIndex: r.dayIndex,
  startTime: r.startTime,
  minutesPerRound: r.minutesPerRound,
  firstCourt: r.firstCourt,
  courtCount: r.courtCount,
  teamLimit: r.teamLimit,
  gamesTo: r.gamesTo,
  gamesPerTeam: r.gamesPerTeam,
  playoffs: r.playoffs as Division['playoffs'],
  bronze: r.bronze as Division['bronze'],
})

async function withDivisions(db: Executor, rows: TournamentRow[]): Promise<Tournament[]> {
  if (!rows.length) return []
  const divs = await db
    .select()
    .from(divisions)
    .where(inArray(divisions.tournamentId, rows.map((r) => r.id)))
    .orderBy(asc(divisions.sort), asc(divisions.id))
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    days: r.days ?? [],
    info: r.info,
    rules: r.rules,
    featured: r.featured,
    visible: r.visible,
    version: r.version,
    liveVersion: r.liveVersion,
    updatedAt: r.updatedAt.toISOString(),
    divisions: divs.filter((d) => d.tournamentId === r.id).map(toDivision),
  }))
}

// by first day, latest first (the club's order for every tournament list); undated ones, the newest announcements, lead
const byFirstDay = sql`coalesce(${tournaments.days}[1], '9999-12-31'::date)`

export async function listTournaments(opts: { visibleOnly?: boolean } = {}): Promise<Tournament[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(tournaments)
    .where(opts.visibleOnly ? eq(tournaments.visible, true) : undefined)
    .orderBy(desc(byFirstDay), desc(tournaments.id))
  return withDivisions(db, rows)
}

export async function getTournament(id: number): Promise<Tournament | null> {
  const db = getDb()
  const rows = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1)
  return (await withDivisions(db, rows))[0] ?? null
}

export async function getTournamentBySlug(slug: string, opts: { visibleOnly?: boolean } = {}): Promise<Tournament | null> {
  const db = getDb()
  const rows = await db
    .select()
    .from(tournaments)
    .where(opts.visibleOnly ? and(eq(tournaments.slug, slug), eq(tournaments.visible, true)) : eq(tournaments.slug, slug))
    .limit(1)
  return (await withDivisions(db, rows))[0] ?? null
}

/** A web address from `name` that no other tournament uses: summer-slam, summer-slam-2, … */
async function uniqueSlug(db: Executor, name: string): Promise<string> {
  const base = slugify(name) || 'tournament'
  const taken = new Set(
    (await db.select({ slug: tournaments.slug }).from(tournaments).where(or(eq(tournaments.slug, base), sql`${tournaments.slug} like ${`${base}-%`}`)))
      .map((r) => r.slug),
  )
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

const blankInfo = (): InfoT => ({
  summary: 'Details to follow.',
  dateLabel: autoDateLabel([]),
  venue: '',
  entryFee: 0,
  includes: [],
  format: 'Round robin',
  prizes: [],
  registrationOpen: false,
})

/** A new, hidden tournament with sensible defaults, ready to fill in. */
/** A new, hidden tournament; its Main Court link (where players register) can be given right away. */
export async function createTournament(name: string, opts: { registrationUrl?: string } = {}): Promise<Tournament> {
  const info: InfoT = { ...blankInfo(), ...(opts.registrationUrl ? { registrationUrl: opts.registrationUrl } : {}) }
  const db = getDb()
  // two creates with the same name at once can pick the same free address: the loser tries the next one
  for (let attempt = 1; ; attempt++) {
    try {
      const [row] = await db
        .insert(tournaments)
        .values({ slug: await uniqueSlug(db, name), name: name.trim(), info, rules: DEFAULT_RULES })
        .returning()
      return (await withDivisions(db, [row]))[0]
    } catch (e) {
      if (!isSlugViolation(e) || attempt >= 5) throw e
    }
  }
}

function isSlugViolation(e: unknown): boolean {
  const err = e as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } }
  const pg = err?.code ? err : err?.cause
  return pg?.code === '23505' && (pg.constraint_name ?? '').includes('slug')
}

/** Save the editor's whole tournament, if it was loaded at `expectedVersion`. Divisions are matched by id. */
export async function saveTournament(id: number, input: TournamentInputT, expectedVersion: number): Promise<Tournament> {
  try {
    return await getDb().transaction(async (tx) => {
      const [row] = await tx.select({ version: tournaments.version }).from(tournaments).where(eq(tournaments.id, id)).limit(1).for('update')
      if (!row) throw new TournamentNotFoundError()
      if (row.version !== expectedVersion) throw new StaleTournamentError()

      // days are stored in order; divisions follow their day to its new position
      const days = normalizeDays(input.days)
      const dayIndexOf = (i: number) => Math.max(0, days.indexOf(input.days[i] ?? days[0]))

      if (input.featured) {
        await tx.execute(sql`select pg_advisory_xact_lock(${FEATURE_LOCK})`)
        await tx.update(tournaments).set({ featured: false }).where(and(eq(tournaments.featured, true), ne(tournaments.id, id)))
      }
      const [updated] = await tx
        .update(tournaments)
        .set({
          slug: input.slug,
          name: input.name,
          days,
          info: input.info,
          rules: input.rules,
          featured: input.featured,
          visible: input.visible,
          version: sql`${tournaments.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(tournaments.id, id))
        .returning()

      // divisions: keep the ones still listed (by id, only this tournament's), add new ones, drop the rest
      const ownIds = new Set((await tx.select({ id: divisions.id }).from(divisions).where(eq(divisions.tournamentId, id))).map((d) => d.id))
      const keep = input.divisions.flatMap((d) => (d.id !== undefined && ownIds.has(d.id) ? [d.id] : []))
      // a division that already has teams or matches can't be dropped by a save (that would wipe its play)
      const dropping = [...ownIds].filter((d) => !keep.includes(d))
      if (dropping.length) {
        const inUse = await tx
          .selectDistinct({ name: divisions.name })
          .from(divisions)
          .where(and(inArray(divisions.id, dropping), sql`exists (select 1 from ${teams} where ${teams.divisionId} = ${divisions.id})`))
        if (inUse.length) throw new DivisionInUseError(inUse.map((r) => r.name))
      }
      // a drawn bracket was made for its format: changing top 4/top 8 or the bronze rule under it would
      // orphan its games. Locking the rows first means playoffs can't be drawn between this check and the save.
      const current = await tx
        .select({ id: divisions.id, name: divisions.name, playoffs: divisions.playoffs, bronze: divisions.bronze })
        .from(divisions)
        .where(eq(divisions.tournamentId, id))
        .orderBy(asc(divisions.id))
        .for('update')
      const reformatted = current.filter((c) => {
        const next = input.divisions.find((d) => d.id === c.id)
        return next !== undefined && (next.playoffs !== c.playoffs || next.bronze !== c.bronze)
      })
      if (reformatted.length) {
        const drawn = await tx
          .selectDistinct({ divisionId: matches.divisionId })
          .from(matches)
          .where(and(inArray(matches.divisionId, reformatted.map((c) => c.id)), ne(matches.stage, 'pool')))
        if (drawn.length) throw new PlayoffsDrawnError(reformatted.filter((c) => drawn.some((x) => x.divisionId === c.id)).map((c) => c.name))
      }
      await tx.delete(divisions).where(keep.length ? and(eq(divisions.tournamentId, id), notInArray(divisions.id, keep)) : eq(divisions.tournamentId, id))
      for (const [sort, d] of input.divisions.entries()) {
        const { id: divisionId, ...fields } = d
        const values = { ...fields, sort, dayIndex: days.length ? dayIndexOf(d.dayIndex) : 0 }
        if (divisionId !== undefined && ownIds.has(divisionId)) {
          await tx.update(divisions).set(values).where(and(eq(divisions.id, divisionId), eq(divisions.tournamentId, id)))
        } else {
          await tx.insert(divisions).values({ ...values, tournamentId: id })
        }
      }
      return (await withDivisions(tx, [updated]))[0]
    })
  } catch (e) {
    if (isSlugViolation(e)) throw new SlugTakenError()
    throw e
  }
}

/** Delete a tournament with its divisions (and, later, its teams and matches). */
export async function deleteTournament(id: number): Promise<void> {
  await getDb().delete(tournaments).where(eq(tournaments.id, id))
}

/** The public site's view of a tournament (the shape its pages and cards already use). */
export function toClubEvent(t: Tournament): ClubEventT {
  const i = t.info
  return {
    id: String(t.id),
    slug: t.slug,
    name: t.name,
    summary: i.summary,
    date: t.days[0] ?? null,
    endDate: t.days.length > 1 ? t.days[t.days.length - 1] : undefined,
    dateLabel: i.dateLabel,
    startTime: i.startTime,
    location: i.venue ?? '',
    entryFee: i.entryFee,
    entryFeeWithMeal: i.entryFeeWithMeal,
    includes: i.includes,
    format: i.format,
    prizes: i.prizes,
    registrationOpen: i.registrationOpen,
    registrationUrl: i.registrationUrl,
    image: i.image,
    flyer: i.flyer,
    logo: i.logo,
    featured: t.featured,
    visible: t.visible,
  }
}

/** Tournaments that use this image (hero photo, logo, flyer or medal), so the photo library won't delete it. */
export async function tournamentImageUsage(src: string): Promise<string[]> {
  const i = tournaments.info
  const rows = await getDb()
    .select({ name: tournaments.name })
    .from(tournaments)
    .where(sql`${i}->'image'->>'src' = ${src} or ${i}->'logo'->>'src' = ${src} or ${i}->'flyer'->>'src' = ${src}
      or ${i}->'medal'->>'src' = ${src} or ${i}->'medalBack'->>'src' = ${src}`)
  return rows.map((r) => `Tournament: ${r.name}`)
}

/* ---------- one-time import of the tournaments that lived in the website content ---------- */

type LegacyEvent = Partial<ClubEventT> & Pick<ClubEventT, 'slug' | 'name'>

function legacyDays(e: LegacyEvent): string[] {
  if (!e.date) return []
  const out = [e.date]
  while (e.endDate && out[out.length - 1] < e.endDate && out.length < 7) out.push(addDaysIso(out[out.length - 1], 1))
  return out
}

async function importOnce(): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${IMPORT_LOCK})`)
    const [done] = await tx.select().from(appMeta).where(eq(appMeta.key, IMPORT_FLAG)).limit(1)
    if (done) return

    // the owner's published tournaments (even an emptied list), else draft-only ones, else the starting content
    const docs = await tx
      .select({ key: siteDocuments.key, events: sql<LegacyEvent[] | null>`${siteDocuments.data}->'events'` })
      .from(siteDocuments)
    const fromDoc = (key: string) => docs.find((d) => d.key === key)?.events
    const saved = fromDoc('published') ?? fromDoc('draft')
    const source: LegacyEvent[] = Array.isArray(saved) ? saved : seedEvents.map((e, i) => ({ ...e, featured: i === 0, visible: true }))

    let featuredUsed = false
    for (const e of source) {
      const featured: boolean = !!e.featured && !featuredUsed
      featuredUsed ||= featured
      const days = legacyDays(e)
      await tx.insert(tournaments).values({
        slug: await uniqueSlug(tx, e.slug || e.name),
        name: e.name,
        days,
        info: {
          summary: e.summary ?? 'Details to follow.',
          dateLabel: e.dateLabel ?? autoDateLabel(days),
          startTime: e.startTime,
          venue: e.location ?? '',
          entryFee: e.entryFee ?? 0,
          entryFeeWithMeal: e.entryFeeWithMeal,
          includes: e.includes ?? [],
          format: e.format ?? 'Round robin',
          prizes: e.prizes ?? [],
          registrationOpen: e.registrationOpen ?? false,
          registrationUrl: e.registrationUrl,
          image: e.image,
          flyer: e.flyer,
          logo: e.logo,
        },
        rules: DEFAULT_RULES,
        featured,
        visible: e.visible ?? true,
      })
    }
    await tx.insert(appMeta).values({ key: IMPORT_FLAG, value: new Date().toISOString() })
    // tournaments live here now; drop the old copy from the website content documents
    await tx.update(siteDocuments).set({ data: sql`${siteDocuments.data} - 'events'` })
  })
}

let imported: Promise<void> | null = null
/** Bring over the tournaments from before they had their own tables, once ever (checked once per process). */
export function ensureImported(): Promise<void> {
  imported ??= importOnce().catch((e) => {
    imported = null
    throw e
  })
  return imported
}
