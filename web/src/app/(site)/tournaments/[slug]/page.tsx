import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { PageHero } from '@/components/PageHero'
import l from '@/components/live.module.css'
import x from '@/components/tournament.module.css'
import ts from '@/components/tournaments.module.css'
import { getClub, getEvents, getNextEvent, getTournamentLive, getTournamentPage } from '@/lib/data'
import { eventState, type EventState } from '@/lib/events'
import { divisionBoard } from '@/lib/match/board'
import { formatTime12 } from '@/lib/match/schedule'
import { pageMeta } from '@/lib/seo'
import { dayLabel } from '@/lib/tournaments/days'
import { BRONZE_LABELS, FORMAT_LABELS, PLAYOFF_LABELS, TIEBREAKER_LABELS } from '@/lib/tournaments/schema'
import type { Club, ClubEvent } from '@/lib/types'
import { asset, money } from '@/lib/utils'

type Params = { params: Promise<{ slug: string }> }
type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentPage>>>
type Division = Tournament['divisions'][number]
type Play = NonNullable<Awaited<ReturnType<typeof getTournamentLive>>>
type PlayDivision = Play['divisions'][number]
type PlayMatch = PlayDivision['matches'][number]
type Tiebreakers = Play['rules']['tiebreakers']

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com'
const SITE = ORIGIN + (process.env.NEXT_PUBLIC_BASE_PATH || '')
const DEFAULT_PHOTO = '/images/club/dominate-podium-1.jpg'
const PLACE_ORDER = ['Gold', 'Silver', 'Bronze']

const EYEBROW: Record<EventState, string> = {
  open: 'Tournament · registration open',
  upcoming: 'Tournament · registration opens soon',
  tba: 'Tournament · date to be announced',
  past: 'Past tournament',
}

/** Search descriptions read best at 120–160 characters: lead with what and when, trim long summaries, pad short ones. */
function describe(t: Tournament): string {
  const venue = t.info.venue?.split(',')[0]?.trim()
  const summary = t.info.summary.replace(/\s+/g, ' ').trim()
  let d = `${t.name}, ${t.info.dateLabel}${venue ? ` at ${venue}` : ''}. ${summary}${/[.!?…]$/.test(summary) ? '' : '.'}`
  for (const extra of ['Divisions, schedule and rules for this Deadly Drops Pickleball tournament in Chula Vista, CA.', 'Divisions, schedule and rules.']) {
    if (d.length + 1 + extra.length <= 160) {
      d = `${d} ${extra}`
      break
    }
  }
  if (d.length <= 160) return d
  const cut = d.slice(0, 159)
  const space = cut.lastIndexOf(' ')
  return (space > 100 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?–-]+$/, '') + '…'
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug
  const t = await getTournamentPage(slug)
  if (!t) return { title: 'Tournaments' }
  return pageMeta(t.name, describe(t), `/tournaments/${slug}/`)
}

/** "08:30" → ["8:30", "AM"] */
function clock(hhmm: string): [string, string] {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return [`${h % 12 || 12}:${String(m).padStart(2, '0')}`, h < 12 ? 'AM' : 'PM']
}
const clockText = (hhmm: string) => clock(hhmm).join(' ')
const courts = (d: Division) => (d.courtCount === 1 ? `Court ${d.firstCourt}` : `Courts ${d.firstCourt}–${d.firstCourt + d.courtCount - 1}`)
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
const fee = (n: number) => (n === 0 ? 'Free' : money(n))

/** The same state the tournament list shows, so this page and the list never disagree. */
function stateOf(t: Tournament, events: ClubEvent[]): EventState {
  const listed = events.find((e) => e.slug === t.slug)
  return eventState(
    listed ?? {
      slug: t.slug, name: t.name, summary: t.info.summary, dateLabel: t.info.dateLabel,
      date: t.days[0] ?? null, endDate: t.days.length > 1 ? t.days[t.days.length - 1] : undefined,
      entryFee: t.info.entryFee, includes: t.info.includes, format: t.info.format, prizes: t.info.prizes,
      registrationOpen: t.info.registrationOpen, registrationUrl: t.info.registrationUrl,
    },
  )
}

/** Register button while sign-up is open on an outside page, otherwise one line on where things stand. */
function Registration({ t, state, formOnList, club }: { t: Tournament; state: EventState; formOnList: boolean; club: Club }) {
  const url = t.info.registrationUrl
  if (state === 'open' && url) {
    return (
      <a href={url} className="btn btn-accent" target="_blank" rel="noopener noreferrer">
        Register now <span className="sr">for {t.name} (opens in a new tab)</span>
      </a>
    )
  }
  if (state === 'open' && formOnList) return <Link href="/tournaments/#register" className="btn btn-accent">Reserve your spot</Link>
  if (state === 'open') {
    return <p className={x.stateLine}>Registration is open. Email <a href={`mailto:${club.email}`}>{club.email}</a> to reserve your spot.</p>
  }
  if (state === 'upcoming') {
    return <p className={x.stateLine}>Registration opens soon. <Link href="/tournaments/#join-email">Join the email list</Link> to hear the moment it does.</p>
  }
  if (state === 'tba') {
    return <p className={x.stateLine}>The date is still to be announced. <Link href="/tournaments/#join-email">Join the email list</Link> to hear first.</p>
  }
  return <p className={x.stateLine}>This tournament is over. <Link href="/community/">See photos and stories</Link> from the day.</p>
}

function DivisionList({ divisions, day, rules, level: H }: { divisions: Division[]; day?: string; rules: Tournament['rules']; level: 'h3' | 'h4' }) {
  return (
    <ul className={x.divisions}>
      {divisions.map((d) => {
        const [hm, half] = clock(d.startTime)
        return (
          <li key={d.id} className={`card ${x.division}`}>
            <H className={x.divName}>{d.name}</H>
            <p className={x.time}>
              <span className="sr">Starts </span>
              <time dateTime={day ? `${day}T${d.startTime}` : d.startTime}>
                <strong>{hm}</strong> <span>{half}</span>
              </time>
            </p>
            <p className={x.format}>{FORMAT_LABELS[d.format]}</p>
            <dl className={x.facts}>
              <div><dt>Courts</dt><dd>{courts(d)}</dd></div>
              {d.teamLimit !== null && <div><dt>Team limit</dt><dd>{plural(d.teamLimit, 'team')}</dd></div>}
              <div><dt>Games to</dt><dd>{d.gamesTo ?? rules.gamesTo}{rules.winBy2 ? ', win by 2' : ''}</dd></div>
              <div><dt>Games per team</dt><dd>{d.gamesPerTeam ?? rules.gamesPerTeam}</dd></div>
              <div className={x.wide}>
                <dt>Playoffs</dt>
                <dd>{PLAYOFF_LABELS[d.playoffs]}{d.playoffs !== 'none' ? ` · ${BRONZE_LABELS[d.bronze]}` : ''}</dd>
              </div>
            </dl>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- live results (Pickle Match play) ---------- */

const STAGE_ORDER: Record<PlayMatch['stage'], number> = { pool: 0, qf: 1, sf: 2, bronze: 3, final: 4 }
const STAGE_LABELS: Record<Exclude<PlayMatch['stage'], 'pool'>, string> = { qf: 'Quarterfinals', sf: 'Semifinals', bronze: 'Bronze match', final: 'Final' }
const playerLine = (names: string[]) => names.join(names.length === 2 ? ' & ' : ', ')
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
const boardMatches = (ms: PlayMatch[]) =>
  ms.map((m) => ({ round: m.round, teamA: m.teamAId, teamB: m.teamBId, scoreA: m.scoreA, scoreB: m.scoreB, status: m.status }))
const hasPlay = (d: PlayDivision) => d.teams.length > 0 || d.matches.length > 0

/** Matches in playing order: each pool round, then each playoff stage. */
function matchGroups(matches: PlayMatch[]) {
  const sorted = [...matches].sort(
    (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.round - b.round || a.slot - b.slot || (a.court ?? 0) - (b.court ?? 0) || a.id - b.id,
  )
  const groups: { key: string; label: string; matches: PlayMatch[] }[] = []
  for (const m of sorted) {
    const key = m.stage === 'pool' ? `r${m.round}` : m.stage
    const last = groups[groups.length - 1]
    if (last?.key === key) last.matches.push(m)
    else groups.push({ key, label: m.stage === 'pool' ? `Round ${m.round}` : STAGE_LABELS[m.stage], matches: [m] })
  }
  return groups
}

function MatchCard({ m, names, day }: { m: PlayMatch; names: Map<number, string>; day?: string }) {
  const a = m.scoreA ?? 0
  const b = m.scoreB ?? 0
  const final = m.status === 'final'
  const sides = [
    { key: 'a', id: m.teamAId, score: a, won: final && a > b },
    { key: 'b', id: m.teamBId, score: b, won: final && b > a },
  ]
  return (
    <li className={l.match} data-status={m.status}>
      <p className={l.matchMeta}>
        {m.startsAt && <time dateTime={day ? `${day}T${m.startsAt}` : m.startsAt}>{formatTime12(m.startsAt)}</time>}
        {m.court !== null && <span>Court {m.court}</span>}
        {m.status !== 'scheduled' && (
          <span className={l.badge} data-status={m.status}>
            {m.status === 'live' && <span className="live-dot" aria-hidden="true" />}
            {m.status === 'live' ? 'Live' : 'Final'}
          </span>
        )}
      </p>
      {sides.map((s) => {
        const name = s.id !== null ? names.get(s.id) : undefined
        return (
          <p key={s.key} className={l.side} data-win={s.won}>
            <span className={name ? undefined : l.tbd}>{name ?? 'To be decided'}</span>
            {m.status !== 'scheduled' && (
              <strong>
                <span className="sr">: </span>
                {s.score}
                {s.won && <span className="sr"> (won)</span>}
              </strong>
            )}
          </p>
        )
      })}
    </li>
  )
}

/** One division's status, standings and matches, or its teams while there's no schedule yet. */
function DivisionResults({ d, tiebreakers, day, level }: { d: PlayDivision; tiebreakers: Tiebreakers; day?: string; level: 3 | 4 }) {
  const H = level === 3 ? 'h3' : 'h4'
  const Sub = level === 3 ? 'h4' : 'h5'
  const id = `results-${d.id}`
  const pool = d.matches.filter((m) => m.stage === 'pool')
  // standings are the round robin's; playoff games only move the status
  const board = divisionBoard({ teams: d.teams, matches: boardMatches(pool), tiebreakers })
  const overall = pool.length === d.matches.length ? board : divisionBoard({ teams: d.teams, matches: boardMatches(d.matches), tiebreakers })
  const state = d.matches.length ? overall.state : 'setup'
  const status =
    state === 'final' ? 'Final'
    : state === 'live' ? (board.liveRound !== null ? `Live · Round ${board.liveRound}` : 'Live · Playoffs')
    : `Starts ${formatTime12(d.startTime)}`
  const ranked = pool.some((m) => m.status === 'final')
  const names = new Map(d.teams.map((t) => [t.id, t.name]))
  const players = new Map(d.teams.map((t) => [t.id, playerLine(t.players.map((p) => p.name))]))

  return (
    <article className={`card ${l.division}`} data-state={state} aria-labelledby={id}>
      <header className={l.divHead}>
        <H id={id} className={l.divName}>{d.name}</H>
        <p className={l.status} data-state={state}>
          {state === 'live' && <span className="live-dot" aria-hidden="true" />}
          {status}
        </p>
        <p className={l.divMeta}>
          {FORMAT_LABELS[d.format]} · {plural(d.teams.length, 'team')} · Games to {d.gamesTo}{d.winBy2 ? ', win by 2' : ''}
        </p>
      </header>

      {d.matches.length > 0 ? (
        <div className={l.body}>
          <div className={l.tableWrap} role="region" aria-labelledby={`${id}-standings`} tabIndex={0}>
            <table className={l.table}>
              <caption id={`${id}-standings`}>Standings<span className="sr">, {d.name}</span></caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Team</th>
                  <th scope="col" className={l.num}><span aria-hidden="true">W–L</span><span className="sr">Wins and losses</span></th>
                  <th scope="col" className={l.num}><span aria-hidden="true">+/−</span><span className="sr">Point difference</span></th>
                </tr>
              </thead>
              <tbody>
                {board.standings.map((s) => {
                  const who = players.get(s.teamId)
                  return (
                    <tr key={s.teamId} data-top={ranked && s.rank === 1}>
                      <td className={l.rank}>{ranked ? s.rank : <><span aria-hidden="true">–</span><span className="sr">Not ranked yet</span></>}</td>
                      <th scope="row">
                        {s.name}
                        {who && who !== s.name && <span className={l.players}>{who}</span>}
                      </th>
                      <td className={l.num}>
                        <span aria-hidden="true">{s.wins}–{s.losses}</span>
                        <span className="sr">{plural(s.wins, 'win')}, {s.losses} {s.losses === 1 ? 'loss' : 'losses'}</span>
                      </td>
                      <td className={l.num}>{signed(s.pointDiff)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={l.rounds}>
            {matchGroups(d.matches).map((g) => (
              <div key={g.key}>
                <Sub id={`${id}-${g.key}`} className={l.roundName}>{g.label}</Sub>
                <ol className={l.matches} aria-labelledby={`${id}-${g.key}`}>
                  {g.matches.map((m) => <MatchCard key={m.id} m={m} names={names} day={day} />)}
                </ol>
              </div>
            ))}
          </div>
        </div>
      ) : d.teams.length > 0 ? (
        <ul className={l.teams} aria-label={`${d.name} teams`}>
          {d.teams.map((team) => {
            const who = players.get(team.id)
            return (
              <li key={team.id}>
                <strong>{team.name}</strong>
                {who && who !== team.name && <span>{who}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={l.empty}>Teams will be announced.</p>
      )}
    </article>
  )
}

export default async function TournamentPage({ params }: Params) {
  const slug = (await params).slug
  const [t, events, next, club] = await Promise.all([getTournamentPage(slug), getEvents(), getNextEvent(), getClub()])
  if (!t) notFound()
  const play = await getTournamentLive(t.id)

  const { info, rules, days } = t
  const state = stateOf(t, events)
  // the tournaments page only carries a sign-up form for the event it leads with
  const formOnList = next?.slug === t.slug && !info.registrationUrl
  const pageUrl = `${SITE}/tournaments/${t.slug}/`

  const dayCount = Math.max(1, days.length)
  const byDay = Array.from({ length: dayCount }, (_, i) =>
    t.divisions.filter((d) => Math.min(d.dayIndex, dayCount - 1) === i).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  )
  const multiDay = days.length > 1
  const scheduleMeta = [multiDay ? plural(days.length, 'day') : null, t.divisions.length ? plural(t.divisions.length, 'division') : null].filter(Boolean).join(' · ')

  // live results: shown once any division has teams; they lead the page from the first score on
  const playDivs = play?.divisions ?? []
  const showResults = playDivs.some(hasPlay)
  const allMatches = playDivs.flatMap((d) => d.matches)
  const started = allMatches.some((m) => m.status !== 'scheduled')
  const finished = started && playDivs.every((d) => (d.matches.length ? d.matches.every((m) => m.status === 'final') : !d.teams.length))
  const resultsTitle = finished ? 'Results' : started ? 'Live results' : allMatches.length ? 'Teams & matches' : 'Teams'
  const resultsFirst = showResults && started
  const playByDay = Array.from({ length: dayCount }, (_, i) =>
    playDivs.filter((d) => Math.min(d.dayIndex, dayCount - 1) === i).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  )
  // until the tournament is over the page follows it, re-rendering within a second of any change
  const following = play !== null && state !== 'past'
  const back = <p className={x.back}><Link href="/tournaments/" className="link-arrow">← All tournaments</Link></p>
  const feed = play && following ? <div className={l.feed}><LiveRefresh tournamentId={play.id} version={play.liveVersion} /></div> : null

  const resultsSection = play && showResults ? (
    <section id="results" className="section darker" aria-labelledby="results-title">
      <div className="wrap">
        {resultsFirst && back}
        {resultsFirst && feed}
        <div className="head-row">
          <h2 id="results-title" className="display d-m">{resultsTitle}</h2>
          {following && (
            <p className={`mono small muted ${l.updates}`}>
              {started && !finished && <span className="live-dot" aria-hidden="true" />}
              Updates automatically
            </p>
          )}
        </div>
        {multiDay ? (
          days.map((iso, i) =>
            playByDay[i].some(hasPlay) ? (
              <div key={iso} className={x.day}>
                <div className={x.dayHead}>
                  <p className="eyebrow">Day {i + 1}</p>
                  <h3 className="display"><time dateTime={iso}>{dayLabel(iso)}</time></h3>
                </div>
                <div className={l.divisions}>
                  {playByDay[i].map((d) => <DivisionResults key={d.id} d={d} tiebreakers={play.rules.tiebreakers} day={iso} level={4} />)}
                </div>
              </div>
            ) : null,
          )
        ) : (
          <div className={l.divisions}>
            {playByDay[0].map((d) => <DivisionResults key={d.id} d={d} tiebreakers={play.rules.tiebreakers} day={days[0]} level={3} />)}
          </div>
        )}
      </div>
    </section>
  ) : null

  const anyPlayoffs = t.divisions.some((d) => d.playoffs !== 'none')
  const overrides = t.divisions.some(
    (d) => (d.gamesTo !== null && d.gamesTo !== rules.gamesTo) || (d.gamesPerTeam !== null && d.gamesPerTeam !== rules.gamesPerTeam),
  )
  const prizes = [...info.prizes].sort((a, b) => PLACE_ORDER.indexOf(a.place) - PLACE_ORDER.indexOf(b.place))
  const hasSide = info.includes.length > 0 || prizes.length > 0
  // the tournament's own logo; the club badge until one is uploaded
  const logo = info.logo ? { src: info.logo.src, alt: info.logo.alt || `${t.name} logo` } : { src: '/logo.png', alt: `${club.name} logo` }

  const [placeName, ...placeRest] = (info.venue ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const jsonLd = days.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: t.name,
        description: info.summary,
        sport: 'Pickleball',
        url: pageUrl,
        startDate: days[0],
        endDate: days[days.length - 1],
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: placeName ?? `${club.city}, CA`,
          address: placeRest.length
            ? placeRest.join(', ')
            : { '@type': 'PostalAddress', addressLocality: club.city, addressRegion: 'CA', addressCountry: 'US' },
        },
        organizer: { '@type': 'SportsOrganization', name: club.name, url: `${SITE}/` },
        ...(info.image ? { image: ORIGIN + asset(info.image.src) } : {}),
        offers: {
          '@type': 'Offer',
          price: info.entryFee,
          priceCurrency: 'USD',
          url: info.registrationUrl ?? pageUrl,
          ...(state === 'open' ? { availability: 'https://schema.org/InStock' } : {}),
        },
      }
    : null

  return (
    <>
      <PageHero
        eyebrow={EYEBROW[state]}
        title={t.name}
        lede={info.summary}
        photo={info.image?.src ?? DEFAULT_PHOTO}
        photoPosition={info.image?.position ?? '50% 40%'}
        aside={
          <div className={x.heroSide}>
            <img className={x.heroLogo} src={asset(logo.src)} alt={logo.alt} width={184} height={184} />
            <div className={ts.entries}>
              <p className="eyebrow">Entry</p>
              <ul className={ts.pool}>
                <li><span>Per player</span><strong>{fee(info.entryFee)}</strong></li>
                {info.entryFeeWithMeal !== undefined && <li><span>With meal</span><strong>{money(info.entryFeeWithMeal)}</strong></li>}
              </ul>
            </div>
          </div>
        }
      >
        <p className={ts.heroWhen}>{days.length === 1 ? <time dateTime={days[0]}>{info.dateLabel}</time> : info.dateLabel}</p>
        {(info.venue || info.startTime) && (
          <p className={x.meta}>
            {info.venue && <span>{info.venue}</span>}
            {info.startTime && (
              <span>Starts <time dateTime={days.length ? `${days[0]}T${info.startTime}` : info.startTime}>{clockText(info.startTime)}</time></span>
            )}
          </p>
        )}
        <Registration t={t} state={state} formOnList={formOnList} club={club} />
      </PageHero>

      {resultsFirst && resultsSection}

      <section className="section dark">
        <div className="wrap">
          {!resultsFirst && back}
          {!resultsFirst && feed}
          <div className={x.layout} data-side={hasSide}>
            <div>
              <div className="head-row">
                <h2 className="display d-m">Schedule</h2>
                {scheduleMeta && <p className="mono small muted">{scheduleMeta}</p>}
              </div>
              {!days.length && <p className={x.tba}>The date is to be announced.</p>}
              {!t.divisions.length ? (
                <p className={ts.more}>Divisions will be announced.</p>
              ) : multiDay ? (
                days.map((iso, i) => (
                  <div key={iso} className={x.day}>
                    <div className={x.dayHead}>
                      <p className="eyebrow">Day {i + 1}</p>
                      <h3 className="display"><time dateTime={iso}>{dayLabel(iso)}</time></h3>
                    </div>
                    {byDay[i].length ? (
                      <DivisionList divisions={byDay[i]} day={iso} rules={rules} level="h4" />
                    ) : (
                      <p className={ts.more}>Divisions for this day will be announced.</p>
                    )}
                  </div>
                ))
              ) : (
                <DivisionList divisions={byDay[0]} day={days[0]} rules={rules} level="h3" />
              )}
              {!showResults && state !== 'past' && <p className={x.liveNote}>Live scores and standings will appear on this page on tournament day.</p>}
            </div>

            {hasSide && (
              <div className={x.side}>
                {info.includes.length > 0 && (
                  <div>
                    <h2 className="display d-s">What’s included</h2>
                    <ul className={x.included}>
                      {info.includes.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {prizes.length > 0 && (
                  <div>
                    <h2 className="display d-s">Prizes</h2>
                    <ul className={x.prizes}>
                      {prizes.map((p) => (
                        <li key={p.place} data-place={p.place}><span>{p.place}</span><strong>{money(p.amount)}</strong></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {!resultsFirst && resultsSection}

      <section className="section light">
        <div className="wrap">
          <div className="head-row">
            <h2 className="display d-m">Rules</h2>
          </div>
          <div className={x.rules} data-notes={rules.notes.length > 0}>
            <div className={x.rulesMain}>
              <h3 className={x.sub}>Scoring</h3>
              <dl className={x.ruleFacts}>
                <div><dt>Points to win</dt><dd>{rules.gamesTo}</dd></div>
                <div><dt>Win by 2</dt><dd>{rules.winBy2 ? 'Yes' : 'No'}</dd></div>
                <div><dt>Games per team</dt><dd>{rules.gamesPerTeam}</dd></div>
                {anyPlayoffs && <div><dt>Playoff points to win</dt><dd>{rules.playoffGamesTo}</dd></div>}
              </dl>
              {overrides && <p className="small muted">Some divisions play to a different score or number of games. The schedule shows each division’s own.</p>}
              <h3 className={x.sub}>Tiebreakers</h3>
              <p className="small muted">Teams level in the standings are separated by, in order:</p>
              <ol className={x.tiebreakers}>
                {rules.tiebreakers.map((tb) => <li key={tb}>{TIEBREAKER_LABELS[tb]}</li>)}
              </ol>
            </div>
            {rules.notes.length > 0 && (
              <ul className={x.notes}>
                {rules.notes.map((n) => (
                  <li key={n.id} className={`card ${x.note}`}>
                    <h3>{n.title}</h3>
                    <p>{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
    </>
  )
}
