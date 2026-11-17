import { beforeEach, describe, expect, it } from 'vitest'
import { getSql } from '@/db/client'
import {
  createTournament,
  deleteTournament,
  ensureImported,
  getTournament,
  getTournamentBySlug,
  listTournaments,
  saveTournament,
  SlugTakenError,
  StaleTournamentError,
  toClubEvent,
  tournamentImageUsage,
  type Tournament,
} from '../repo'
import { TournamentInput, type TournamentInputT } from '../schema'

beforeEach(async () => {
  await getSql()`truncate tournaments, divisions, app_meta restart identity cascade`
})

/** The editor's payload for a stored tournament, with changes; parsed exactly as the server action does. */
function input(t: Tournament, patch: Partial<TournamentInputT> = {}): TournamentInputT {
  return TournamentInput.parse({
    name: t.name, slug: t.slug, days: t.days, featured: t.featured, visible: t.visible, info: t.info, rules: t.rules,
    divisions: t.divisions.map(({ tournamentId: _t, sort: _s, ...d }) => d),
    ...patch,
  })
}

const division = (name: string, dayIndex = 0) => ({
  name, format: 'mixed' as const, dayIndex, startTime: '08:00', minutesPerRound: 17, firstCourt: 1, courtCount: 4,
  teamLimit: 8, gamesTo: null, gamesPerTeam: null, playoffs: 'none' as const, bronze: 'standings' as const,
})

describe('tournaments', () => {
  it('creates a hidden draft with a web address from its name, unique each time', async () => {
    const a = await createTournament('Summer Slam 2027')
    const b = await createTournament('Summer Slam 2027')
    expect(a).toMatchObject({ slug: 'summer-slam-2027', visible: false, featured: false, days: [], version: 1 })
    expect(b.slug).toBe('summer-slam-2027-2')
  })

  it('keeps the Main Court link given when the tournament is created, and it passes the editor’s checks', async () => {
    const link = 'https://maincourt.com/events-list/summer-slam-2027/'
    const t = await createTournament('Summer Slam 2027', { registrationUrl: link })
    expect(t.info.registrationUrl).toBe(link)
    expect((await getTournament(t.id))?.info.registrationUrl).toBe(link)
    expect(TournamentInput.safeParse(input(t)).success).toBe(true)
    expect((await createTournament('Autumn Open')).info.registrationUrl).toBeUndefined()
  })

  it('saves days and divisions, keeps division ids, and removes divisions that were taken out', async () => {
    const t = await createTournament('Two Day Open')
    const saved = await saveTournament(t.id, input(t, {
      days: ['2027-03-06', '2027-03-07'],
      divisions: [division('3.5 Mixed', 0), division('4.0 Mens', 1)],
    }), t.version)
    expect(saved.version).toBe(2)
    expect(saved.divisions.map((d) => [d.name, d.dayIndex])).toEqual([['3.5 Mixed', 0], ['4.0 Mens', 1]])

    const keep = saved.divisions[1]
    const again = await saveTournament(t.id, input(saved, { divisions: [{ ...keep, name: '4.0 Men' }] }), saved.version)
    expect(again.divisions).toHaveLength(1)
    expect(again.divisions[0]).toMatchObject({ id: keep.id, name: '4.0 Men' })
    const [{ n }] = await getSql()`select count(*)::int as n from divisions`
    expect(n).toBe(1)
  })

  it('refuses a save based on an old copy', async () => {
    const t = await createTournament('Busy Day')
    await saveTournament(t.id, input(t, { name: 'Busy Day Open' }), t.version)
    await expect(saveTournament(t.id, input(t, { name: 'Lost edit' }), t.version)).rejects.toBeInstanceOf(StaleTournamentError)
  })

  it('refuses a web address another tournament already has', async () => {
    const a = await createTournament('Alpha')
    const b = await createTournament('Beta')
    await expect(saveTournament(b.id, input(b, { slug: a.slug }), b.version)).rejects.toBeInstanceOf(SlugTakenError)
  })

  it('gives two tournaments created at the same moment different web addresses', async () => {
    const [a, b] = await Promise.all([createTournament('Same Name Cup'), createTournament('Same Name Cup')])
    expect(new Set([a.slug, b.slug]).size).toBe(2)
  })

  it('keeps one featured tournament even when two are featured at the same moment', async () => {
    const a = await createTournament('Alpha')
    const b = await createTournament('Beta')
    const results = await Promise.allSettled([
      saveTournament(a.id, input(a, { featured: true }), a.version),
      saveTournament(b.id, input(b, { featured: true }), b.version),
    ])
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    const [{ n }] = await getSql()`select count(*)::int as n from tournaments where featured`
    expect(n).toBe(1)
  })

  it('keeps only one featured tournament', async () => {
    const a = await createTournament('Alpha')
    const b = await createTournament('Beta')
    await saveTournament(a.id, input(a, { featured: true }), a.version)
    await saveTournament(b.id, input(b, { featured: true }), b.version)
    expect((await getTournament(a.id))?.featured).toBe(false)
    expect((await getTournament(b.id))?.featured).toBe(true)
  })

  it('shows the public site only visible tournaments, in the shape its pages use', async () => {
    const t = await createTournament('Charity Classic')
    const saved = await saveTournament(t.id, input(t, { visible: true, days: ['2027-06-13', '2027-06-14'] }), t.version)
    await createTournament('Hidden Draft')

    const listed = await listTournaments({ visibleOnly: true })
    expect(listed.map((x) => x.name)).toEqual(['Charity Classic'])
    expect(await getTournamentBySlug('hidden-draft', { visibleOnly: true })).toBeNull()

    const ev = toClubEvent(saved)
    expect(ev).toMatchObject({ slug: 'charity-classic', date: '2027-06-13', endDate: '2027-06-14', visible: true })
    expect(toClubEvent({ ...saved, days: [] }).date).toBeNull()
  })

  it('finds which tournament uses a photo as its poster', async () => {
    const t = await createTournament('Poster Cup')
    await saveTournament(t.id, input(t, { info: { ...t.info, image: { src: '/images/club/dominate-medals.jpg', alt: 'Medals' } } }), t.version)
    expect(await tournamentImageUsage('/images/club/dominate-medals.jpg')).toEqual(['Tournament: Poster Cup'])
    expect(await tournamentImageUsage('/images/club/other.jpg')).toEqual([])
  })

  it('deletes a tournament with its divisions', async () => {
    const t = await createTournament('Gone Soon')
    await saveTournament(t.id, input(t, { divisions: [division('Open')] }), t.version)
    await deleteTournament(t.id)
    expect(await getTournament(t.id)).toBeNull()
    const [{ n }] = await getSql()`select count(*)::int as n from divisions`
    expect(n).toBe(0)
  })

  it('imports the existing tournaments once, and never again after they are deleted', async () => {
    await ensureImported()
    const first = await listTournaments()
    expect(first.length).toBeGreaterThan(0)
    expect(first.every((t) => t.visible)).toBe(true)

    for (const t of first) await deleteTournament(t.id)
    await ensureImported()
    expect(await listTournaments()).toEqual([])
  })
})
