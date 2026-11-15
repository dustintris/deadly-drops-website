/**
 * Data access for every page. Today these read local content files; when the
 * club backend exists, swap each body for an API / database call. Pages only
 * import from here, never from src/content directly.
 */
import { club, events, faqs, tickerItems } from '@/content/club'
import * as sample from '@/content/sample'
import type { Division } from './types'

export const getClub = async () => club
export const getEvents = async () => events
export const getNextEvent = async () => events.find((e) => e.registrationOpen) ?? events[0]
export const getFaqs = async () => faqs
export const getTicker = async () => tickerItems

export const getMembers = async (division?: Division) =>
  division ? sample.members.filter((m) => m.division === division) : sample.members
export const getMember = async (slug: string) => sample.members.find((m) => m.slug === slug) ?? null
export const getMemberCount = async () => sample.members.length
export const getSpotlights = async () => sample.spotlights
export const getLadder = async () => sample.ladder
export const getLiveMatch = async () => sample.liveMatch
export const getBracket = async () => sample.bracket
export const getChampions = async () => sample.champions
export const getDivisionGuide = async () => sample.divisionGuide
export const getCommittee = async () => sample.committee

export const getProducts = async () => sample.products
export const getProduct = async (slug: string) => sample.products.find((p) => p.slug === slug) ?? null
export const memberDiscount = sample.MEMBER_DISCOUNT

export const getGallery = async () => sample.gallery
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
