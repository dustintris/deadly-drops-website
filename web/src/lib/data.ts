/**
 * Data access for every page. Owner-editable content (club info, events, ticker, shop, gallery,
 * community, charities, FAQs, page copy, theme) comes from the MIS content store via getContent(); tournaments
 * and their live play come from the database; member and ladder data are still sample content in
 * src/content/sample.ts.
 * Pages only import from here, never from src/content or the store directly.
 */
import { cache } from 'react'
import { getContent, isPreview } from './content'
import { clubToday, eventState } from './events'
import { getTournamentPlay, tournamentsWithPlay, type TournamentPlay } from './play/repo'
import { charitiesForTournament } from './charities'
import type { CommunityPostT, PageKey } from './content-schema'
import { tournamentBasics } from '@/content/club'
import * as sample from '@/content/sample'
import { themeLogo } from '@/theme/tokens'
import { ensureImported, getTournamentBySlug, listTournaments, toClubEvent, type Tournament } from './tournaments/repo'
import type { Club, ClubEvent, GalleryItem, Product } from './types'
import type { Division } from './types'

export const getClub = async (): Promise<Club> => (await getContent()).settings
export const getSettings = async () => (await getContent()).settings
export const getTheme = async () => (await getContent()).theme
/** The club logo (Admin → Logo & colours), the draft one while previewing; the bundled badge until one is uploaded. */
export const getClubLogo = async () => themeLogo((await getContent()).theme)
export const getNotice = async () => {
  const n = (await getContent()).settings.notice
  return n.enabled && n.text ? n : null
}
export const getShopSettings = async () => (await getContent()).settings.shop
export const getPageCopy = async (key: PageKey) => (await getContent()).pages[key]

/** Visible tournaments, earliest first. Live from the database: no publish step, once per request. */
export const getEvents = cache(async (): Promise<ClubEvent[]> => {
  await ensureImported()
  return (await listTournaments({ visibleOnly: true })).map(toClubEvent)
})
/** One visible tournament with its days, divisions and rules, for its own page. */
export const getTournamentPage = cache(async (slug: string): Promise<Tournament | null> => {
  await ensureImported()
  return getTournamentBySlug(slug, { visibleOnly: true })
})
/**
 * The tournament the site leads with: a featured upcoming one, else the next upcoming; with nothing ahead,
 * the featured one, else the latest past one (with its results). null if none is visible.
 */
export const getNextEvent = async (): Promise<ClubEvent | null> => {
  const list = await getEvents()
  const byDate = [...list].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  const coming = byDate.filter((e) => eventState(e) !== 'past')
  return (
    coming.find((e) => e.featured) ??
    coming[0] ??
    list.find((e) => e.featured) ??
    byDate.reverse().find((e) => eventState(e) === 'past') ??
    null
  )
}
/* ---------- live tournament play ---------- */

/** A visible tournament's teams, schedule and scores (null while it's hidden). Once per request. */
export const getTournamentLive = cache(async (tournamentId: number): Promise<TournamentPlay | null> => {
  await ensureImported()
  const play = await getTournamentPlay(tournamentId)
  return play?.visible ? publicPlay(play) : null
})

/**
 * Ids of the visible tournaments that have teams or matches, so their page shows results. One query for
 * the whole list (instead of loading each tournament's play), once per request; hidden ones never count.
 */
export const getTournamentsWithPlay = cache(async (): Promise<Set<number>> => {
  const ids = (await getEvents()).map((e) => Number(e.id)).filter(Number.isInteger)
  return tournamentsWithPlay(ids)
})

/** Play as the public may see it: who checked in, and when, stays with the staff. */
export function publicPlay(play: TournamentPlay): TournamentPlay {
  return {
    ...play,
    divisions: play.divisions.map((d) => ({
      ...d,
      teams: d.teams.map((t) => ({ ...t, players: t.players.map((p) => ({ ...p, checkedInAt: null, checkedInBy: null })) })),
    })),
  }
}

/** The lead tournament's play (the one getNextEvent picks) until its last day is over, so a match left "live" never lingers on the site. */
const leadPlay = cache(async (): Promise<TournamentPlay | null> => {
  const event = await getNextEvent()
  const id = Number(event?.id)
  if (!event || !Number.isInteger(id) || eventState(event) === 'past') return null
  return getTournamentLive(id)
})

export type LiveTeam = { name: string; players: string[] }
export type LiveMatch = {
  tournamentId: number
  tournamentName: string
  slug: string
  division: string
  court: number | null
  /** points that win this game (playoff games can differ) */
  gamesTo: number
  teamA: LiveTeam
  teamB: LiveTeam
  scoreA: number
  scoreB: number
}

/** The first match being played right now at the lead tournament (division order, then round and court), or null. */
export const getLiveMatch = cache(async (): Promise<LiveMatch | null> => {
  const play = await leadPlay()
  if (!play) return null
  for (const d of play.divisions) {
    const m = d.matches.find((x) => x.status === 'live' && x.teamAId !== null && x.teamBId !== null)
    if (!m) continue
    const team = (id: number | null): LiveTeam => {
      const t = d.teams.find((x) => x.id === id)
      return { name: t?.name ?? 'To be decided', players: t?.players.map((p) => p.name) ?? [] }
    }
    return {
      tournamentId: play.id,
      tournamentName: play.name,
      slug: play.slug,
      division: d.name,
      court: m.court,
      gamesTo: m.stage === 'pool' ? d.gamesTo : play.rules.playoffGamesTo,
      teamA: team(m.teamAId),
      teamB: team(m.teamBId),
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
    }
  }
  return null
})

/**
 * The lead tournament's live channel while it's being played (today is one of its days, or a match
 * is live), so the home page can follow it and its live card comes and goes by itself. Otherwise null.
 */
export const getLiveFeed = cache(async (): Promise<{ tournamentId: number; version: number } | null> => {
  const play = await leadPlay()
  if (!play) return null
  const playing = play.days.includes(clubToday()) || play.divisions.some((d) => d.matches.some((m) => m.status === 'live'))
  return playing ? { tournamentId: play.id, version: play.liveVersion } : null
})

/* ---------- charities ---------- */

/** The charities the tournaments play for, in the admin's order. */
export const getCharities = async () => (await getContent()).charities
/** Visible sponsors, in the owner's order (the Sponsors page groups them by level). */
export const getSponsors = async () => (await getContent()).sponsors.filter((x) => x.visible)
/** The Volunteers page: its visible volunteers and roles, perks and sign-up settings. */
export const getVolunteers = async () => {
  const v = (await getContent()).volunteers
  return { ...v, people: v.people.filter((p) => p.visible), roles: v.roles.filter((r) => r.visible) }
}
/** The charities one tournament plays for (none, one, or more). */
export const getTournamentCharities = async (slug: string) => charitiesForTournament((await getContent()).charities, slug)
/** How a Deadly Drops tournament runs (age + DUPR brackets, round robin, charity focus, meal and shirt). */
export const getTournamentBasics = async () => tournamentBasics

export const getFaqs = async () => (await getContent()).faqs.filter((f) => f.visible)
export const getTicker = async () => (await getContent()).ticker.filter((t) => t.visible).map((t) => t.text)

export const getMembers = async (division?: Division) =>
  division ? sample.members.filter((m) => m.division === division) : sample.members
export const getMember = async (slug: string) => sample.members.find((m) => m.slug === slug) ?? null
export const getMemberCount = async () => sample.members.length
export const getSpotlights = async () => sample.spotlights
export const getLadder = async () => sample.ladder
export const getChampions = async () => sample.champions
export const getDivisionGuide = async () => sample.divisionGuide
export const getCommittee = async () => sample.committee

export const getProducts = async (): Promise<Product[]> =>
  (await getContent()).products.filter((p) => p.visible).map((p) => ({ ...p, stock: p.stock ?? null }))
export const getProduct = async (slug: string) => (await getProducts()).find((p) => p.slug === slug) ?? null
export const getMemberDiscount = async () => (await getContent()).settings.shop.memberDiscount

export const getGallery = async (): Promise<GalleryItem[]> =>
  (await getContent()).gallery.filter((g) => g.visible).map((g) => ({
    id: g.id, caption: g.caption, meta: g.meta, album: g.album, src: g.image.src, position: g.image.position ?? '50% 50%',
    alt: g.image.alt, wide: g.wide, shotBy: g.shotBy,
  }))

/* ---------- community ---------- */
// while the owner previews, draft posts show too, so they can be checked before publishing
const livePosts = async () => {
  const preview = await isPreview()
  return (await getContent()).posts.filter((p) => preview || p.status === 'published').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}
export const getCommunityPosts = async (kind?: CommunityPostT['kind']) => (await livePosts()).filter((p) => !kind || p.kind === kind)
export const getCommunityPost = async (slug: string) => (await livePosts()).find((p) => p.slug === slug) ?? null
export const getCommunityPhotos = async () => (await getGallery()).filter((g) => g.album === 'Community' || g.album === 'Socials')
export const getMe = async () => sample.me

/** Player dashboard numbers. Sample: derived from the member until real match data exists. */
export const getProfile = async (slug: string) => {
  const m = sample.members.find((x) => x.slug === slug)
  if (!m) return null
  if (m.slug === sample.me.member.slug) return { ...sample.me, member: m }
  const seed = m.tone + 3
  const wins = 10 + ((seed * 7) % 22)
  const trend = Array.from({ length: 12 }, (_, i) => Math.round((m.rating - 0.34 + i * 0.03 + (((seed + i) * 13) % 7) / 100) * 100) / 100)
  trend[11] = m.rating
  return {
    member: m,
    ladderRank: 4 + ((seed * 5) % 40),
    record: `${wins}-${4 + (seed % 14)}`,
    winStreak: 1 + (seed % 6),
    sessions: 12 + ((seed * 11) % 50),
    upcoming: 1 + (seed % 3),
    ratingDelta: Math.round((trend[11] - trend[8]) * 100) / 100,
    trend,
    nextMatches: sample.me.nextMatches,
    results: sample.me.results,
    tonight: sample.me.tonight,
  }
}
export type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>
