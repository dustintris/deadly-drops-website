/**
 * Division champions for the tournaments page: the gold medallists of the latest finished tournament,
 * taken from the play recorded on the day with the same medal rule as its results (medals() in
 * match/present). Nothing until a finished tournament has a decided gold, so no champion is ever made up.
 */
import { cache } from 'react'
import { getEvents, getTournamentLive, getTournamentsWithPlay } from './data'
import { eventState } from './events'
import { medals, playerLine } from './match/present'
import type { TournamentPlay } from './play/repo'

export type Champion = { divisionId: number; division: string; team: string; players: string }
export type Champions = { tournament: string; slug: string; winners: Champion[] }

/** Each division's gold medallist, in division order; divisions without a decided gold are left out. */
export function divisionChampions(play: TournamentPlay): Champion[] {
  return play.divisions.flatMap((d) => {
    const gold = medals(d, play.rules.tiebreakers).find((m) => m.place === 'gold')
    const team = gold && d.teams.find((t) => t.id === gold.teamId)
    return team ? [{ divisionId: d.id, division: d.name, team: team.name, players: playerLine(team.players.map((p) => p.name)) }] : []
  })
}

/** The newest finished (and visible) tournament that crowned a champion, or null. Once per request. */
export const getLatestChampions = cache(async (): Promise<Champions | null> => {
  const [events, withPlay] = await Promise.all([getEvents(), getTournamentsWithPlay()])
  const finished = events
    .filter((e) => eventState(e) === 'past' && withPlay.has(Number(e.id)))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  for (const e of finished) {
    const play = await getTournamentLive(Number(e.id))
    const winners = play ? divisionChampions(play) : []
    if (winners.length) return { tournament: e.name, slug: e.slug, winners }
  }
  return null
})
