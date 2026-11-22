import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveRefresh } from '@/components/LiveRefresh'
import { DEFAULT_HERO_PHOTO, PageHero } from '@/components/PageHero'
import { CloudEdge, Sparkles } from '@/components/Sky'
import l from '@/components/live.module.css'
import { DivisionResults } from '@/components/results/Results'
import x from '@/components/tournament.module.css'
import ts from '@/components/tournaments.module.css'
import ch from '@/app/(site)/charity/charity.module.css'
import sp from '@/app/(site)/sponsors/sponsors.module.css'
import { charityHref, websiteLabel } from '@/lib/charities'
import type { CharityT, SponsorT } from '@/lib/content-schema'
import { getClub, getClubLogo, getEvents, getSponsors, getTournamentCharities, getTournamentLive, getTournamentPage } from '@/lib/data'
import { sponsorHref, sponsorsForTournament } from '@/lib/sponsors'
import { eventState, type EventState } from '@/lib/events'
import { hasPlay, plural } from '@/lib/match/present'
import { pageMeta } from '@/lib/seo'
import { dayLabel } from '@/lib/tournaments/days'
import { BRONZE_LABELS, FORMAT_LABELS, PLAYOFF_LABELS, TIEBREAKER_LABELS } from '@/lib/tournaments/schema'
import type { ClubEvent } from '@/lib/types'
import { asset, money } from '@/lib/utils'

type Params = { params: Promise<{ slug: string }> }
type Tournament = NonNullable<Awaited<ReturnType<typeof getTournamentPage>>>
type Division = Tournament['divisions'][number]

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://deadlydropspickleball.com'
const SITE = ORIGIN + (process.env.NEXT_PUBLIC_BASE_PATH || '')
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

/**
 * Registration is on Main Court: while it's open, the button goes to this tournament's Main Court page;
 * otherwise one line on where things stand.
 */
function Registration({ t, state }: { t: Tournament; state: EventState }) {
  const url = t.info.registrationUrl
  if (state === 'open' && url) {
    return (
      <div className={x.register}>
        <a href={url} className="btn btn-accent" target="_blank" rel="noopener noreferrer">
          Register on Main Court <span className="sr">for {t.name} (opens in a new tab)</span>
        </a>
        <p className="small muted">Divisions, entry and payment are on Main Court. <Link href="/tournaments/#register">How to register</Link></p>
      </div>
    )
  }
  if (state === 'open') {
    return <p className={x.stateLine}>Registration is open on Main Court. <Link href="/tournaments/#register">See how to register</Link>.</p>
  }
  if (state === 'upcoming') {
    return <p className={x.stateLine}>Registration opens soon on Main Court. <Link href="/tournaments/#join-email">Join the email list</Link> to hear the moment it does.</p>
  }
  if (state === 'tba') {
    return <p className={x.stateLine}>The date is still to be announced. <Link href="/tournaments/#join-email">Join the email list</Link> to hear first.</p>
  }
  return (
    <div className={x.register}>
      <p className={x.stateLine}>This tournament is over.</p>
      <div className={x.pastCtas}>
        <Link href={PHOTOS_HREF} className="btn btn-accent btn-lg">See all the photos</Link>
        <Link href="/community/" className="link-arrow">Stories from the day →</Link>
      </div>
    </div>
  )
}

/** The gallery, opened on its tournament photos. */
const PHOTOS_HREF = '/gallery/?album=Tournaments'

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

/**
 * "Playing for <charity>": the charity's summary and links, with its flyer (or logo) beside this tournament's
 * own flyer (else its poster, else its logo). Without a charity image only the tournament's flyer shows: its logo never stands alone here.
 */
function PlayingFor({ c, t }: { c: CharityT; t: Tournament }) {
  const theirs = c.flyer
    ? { ...c.flyer, alt: c.flyer.alt || `${c.name} flyer`, caption: `${c.name} flyer`, kind: 'flyer' }
    : c.logo ? { ...c.logo, alt: c.logo.alt || `${c.name} logo`, caption: c.name, kind: 'logo' } : null
  const ours = t.info.flyer
    ? { ...t.info.flyer, alt: t.info.flyer.alt || `${t.name} flyer`, caption: `${t.name} flyer`, kind: 'flyer' }
    : t.info.image
    ? { ...t.info.image, alt: t.info.image.alt || `${t.name} poster`, caption: `${t.name} poster`, kind: 'poster' }
    : t.info.logo ? { ...t.info.logo, alt: t.info.logo.alt || `${t.name} logo`, caption: t.name, kind: 'logo' } : null
  // the tournament's flyer may stand alone (until the charity's is uploaded); its logo never does
  const images = theirs ? [theirs, ...(ours ? [ours] : [])] : ours && ours.kind === 'flyer' ? [ours] : []
  const titleId = `playing-for-${c.slug}`
  return (
    <section className={ch.playing} data-media={images.length > 0} aria-labelledby={titleId}>
      <div data-reveal="left">
        <p className="eyebrow">Charity</p>
        <h2 id={titleId} className="display d-m">Playing for <span className="accent">{c.name}</span></h2>
        {c.tagline && <p className={ch.tagline}>{c.tagline}</p>}
        <p className="lede">{c.summary}</p>
        <div className={ch.actions} style={{ marginTop: 24 }}>
          <Link href={charityHref(c)} className="btn btn-accent">Read their story<span className="sr"> about {c.name}</span></Link>
          <a href={c.website} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            Visit {websiteLabel(c.website, c.name)} <span aria-hidden="true">↗</span><span className="sr"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
      {images.length > 0 && (
        <div className={ch.pair} data-count={images.length} data-reveal="zoom">
          {images.map((img, i) => (
            <figure key={`${i}-${img.src}`} data-kind={img.kind}>
              <img src={asset(img.src)} alt={img.alt} loading="lazy" decoding="async" />
              <figcaption>{img.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}

/** A tournament with its flyer but no charity partner named yet: the flyer gets the band "Playing for" would use. */
function OwnFlyer({ t, flyer }: { t: Tournament; flyer: NonNullable<Tournament['info']['flyer']> }) {
  return (
    <section className={ch.playing} data-media="true" aria-labelledby="tournament-flyer">
      <div data-reveal="left">
        <p className="eyebrow">Flyer</p>
        <h2 id="tournament-flyer" className="display d-m">The <span className="accent">flyer</span></h2>
        <p className="lede">Everything on one page: save it, print it, or send it to your partner.</p>
        <div className={ch.actions} style={{ marginTop: 24 }}>
          <a href={asset(flyer.src)} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            Open full size <span aria-hidden="true">↗</span><span className="sr"> (the {t.name} flyer opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className={ch.pair} data-count={1} data-reveal="zoom">
        <figure data-kind="flyer">
          <img src={asset(flyer.src)} alt={flyer.alt || `${t.name} flyer`} loading="lazy" decoding="async" />
          <figcaption>{t.name} flyer</figcaption>
        </figure>
      </div>
    </section>
  )
}

/**
 * The medal made for this tournament, after the charity or flyer in the same night band. Medal photos are usually
 * landscape (often front and back in one picture), so the images take the wide shape, not the flyer's portrait one.
 */
function MedalBlock({ t, medal, back }: { t: Tournament; medal: NonNullable<Tournament['info']['medal']>; back: Tournament['info']['medalBack'] }) {
  const images = [
    { ...medal, alt: medal.alt || `${t.name} medal`, caption: back ? 'Front' : `${t.name} medal` },
    ...(back ? [{ ...back, alt: back.alt || `${t.name} medal, back`, caption: 'Back' }] : []),
  ]
  return (
    <section className={ch.playing} data-media="true" aria-labelledby="tournament-medal">
      <div data-reveal="left">
        <p className="eyebrow">Medal</p>
        <h2 id="tournament-medal" className="display d-m">The <span className="accent">medal</span></h2>
        {/* the organiser's own line, else a neutral one: it never promises who wins a medal */}
        <p className="lede">{t.info.medalNote || `The medal made for ${t.name}.`}</p>
        <div className={ch.actions} style={{ marginTop: 24 }}>
          <a href={asset(medal.src)} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            Open full size <span aria-hidden="true">↗</span>
            <span className="sr"> ({back ? 'the front of the' : 'the'} {t.name} medal opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className={ch.pair} data-count={images.length} data-shape="wide" data-reveal="zoom">
        {images.map((img, i) => (
          <figure key={`${i}-${img.src}`} data-kind="medal">
            <img src={asset(img.src)} alt={img.alt} loading="lazy" decoding="async" />
            <figcaption>{img.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

/**
 * "Sponsored by": a quiet row of the sponsors who ticked this tournament (Title first), the last block of the charity
 * band. Each logo (or name, without one) links to the sponsor's website, else to their card on the Sponsors page.
 */
function SponsoredBy({ sponsors }: { sponsors: SponsorT[] }) {
  return (
    <section className={sp.strip} aria-labelledby="sponsored-by" data-reveal>
      <h2 id="sponsored-by" className="eyebrow">Sponsored by</h2>
      <ul className={sp.stripList}>
        {sponsors.map((sponsor) => {
          const mark = sponsor.logo
            ? <img src={asset(sponsor.logo.src)} alt={sponsor.logo.alt || `${sponsor.name} logo`} loading="lazy" decoding="async" />
            : sponsor.name
          return (
            <li key={sponsor.id} data-level={sponsor.level}>
              {sponsor.website ? (
                <a href={sponsor.website} className={sp.stripItem} data-logo={!!sponsor.logo} target="_blank" rel="noopener noreferrer">
                  {mark}<span className="sr"> (opens in a new tab)</span>
                </a>
              ) : (
                <Link href={sponsorHref(sponsor)} className={sp.stripItem} data-logo={!!sponsor.logo}>{mark}</Link>
              )}
            </li>
          )
        })}
      </ul>
      <Link href="/sponsors/" className="link-arrow">All our sponsors →</Link>
    </section>
  )
}

export default async function TournamentPage({ params }: Params) {
  const slug = (await params).slug
  const [t, events, club, charities, allSponsors] = await Promise.all([
    getTournamentPage(slug), getEvents(), getClub(), getTournamentCharities(slug), getSponsors(),
  ])
  if (!t) notFound()
  const sponsors = sponsorsForTournament(allSponsors, slug)
  const play = await getTournamentLive(t.id)

  const { info, rules, days } = t
  const state = stateOf(t, events)
  const pageUrl = `${SITE}/tournaments/${t.slug}/`
  // the image search engines and link previews show for the event: its hero photo, else its flyer
  const previewImage = info.image ?? info.flyer

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
        <div className="head-row" data-reveal>
          <h2 id="results-title" className="display d-m">{resultsTitle}</h2>
          {following && (
            <p className={`mono small muted ${l.updates}`}>
              {started && !finished && <span className="live-dot" aria-hidden="true" />}
              Updates automatically
            </p>
          )}
          <p className="mono small"><Link href={`/display/${t.slug}/print/`} className="link-arrow">Printable results</Link></p>
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
  // the entry band under the hero (price, what's included, register) only while the tournament is ahead;
  // once it's over, the price goes and what was included stays beside the schedule
  const showEntry = state !== 'past'
  const sideIncludes = !showEntry && info.includes.length > 0
  const hasSide = sideIncludes || prizes.length > 0
  // the tournament's own logo; the club badge until one is uploaded
  const logo = info.logo ? { src: info.logo.src, alt: info.logo.alt || `${t.name} logo` } : { src: (await getClubLogo()).src, alt: `${club.name} logo` }

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
        ...(previewImage ? { image: ORIGIN + asset(previewImage.src) } : {}),
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
        photo={info.image?.src ?? DEFAULT_HERO_PHOTO.src}
        photoPosition={info.image ? info.image.position : DEFAULT_HERO_PHOTO.position}
        aside={
          <div className={x.heroSide}>
            <img className={x.heroLogo} src={asset(logo.src)} alt={logo.alt} width={184} height={184} />
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
        <Registration t={t} state={state} />
      </PageHero>

      {/* what it costs and what you get, under the hero while the tournament is still ahead */}
      {showEntry && (
        <section className={`section-tight dark ${x.entryBand}`} aria-labelledby="entry-title">
          <div className={`wrap ${x.entry}`} data-reveal>
            <div>
              <h2 id="entry-title" className="eyebrow">Entry</h2>
              <ul className={x.entryPrices}>
                <li><strong>{fee(info.entryFee)}</strong><span>Per player</span></li>
                {info.entryFeeWithMeal !== undefined && <li><strong>{money(info.entryFeeWithMeal)}</strong><span>With meal</span></li>}
              </ul>
            </div>
            {info.includes.length > 0 && (
              <div>
                <p className="eyebrow">What’s included</p>
                <ul className={`chips ${x.entryIncluded}`}>
                  {info.includes.map((item, k) => <li key={`${k}-${item}`} className="tag">{item}</li>)}
                </ul>
              </div>
            )}
            {state === 'open' && info.registrationUrl && (
              <a href={info.registrationUrl} className={`btn btn-accent ${x.entryCta}`} target="_blank" rel="noopener noreferrer">
                Register on Main Court <span className="sr">for {t.name} (opens in a new tab)</span>
              </a>
            )}
          </div>
        </section>
      )}

      {resultsFirst && resultsSection}

      <section className="section dark">
        <div className="wrap">
          {!resultsFirst && back}
          {!resultsFirst && feed}
          <div className={x.layout} data-side={hasSide}>
            <div>
              <div className="head-row" data-reveal>
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
              <div className={x.side} data-reveal="right">
                {sideIncludes && (
                  <div>
                    <h2 className="display d-s">What’s included</h2>
                    <ul className={x.included}>
                      {info.includes.map((item, k) => <li key={`${k}-${item}`}>{item}</li>)}
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

      {(charities.length > 0 || t.info.flyer || t.info.medal || sponsors.length > 0) && (
        <section className={`section darker rule-top ${ch.playingBand}`}>
          <Sparkles />
          <div className={`wrap ${ch.playingInner}`}>
            {charities.length > 0
              ? charities.map((c) => <PlayingFor key={c.id} c={c} t={t} />)
              : t.info.flyer && <OwnFlyer t={t} flyer={t.info.flyer} />}
            {/* after the charity or flyer; .playing + .playing spaces it from the block before */}
            {t.info.medal && <MedalBlock t={t} medal={t.info.medal} back={t.info.medalBack} />}
            {/* last in the band, so it sits above the clouds; a dashed rule spaces it from any block before */}
            {sponsors.length > 0 && <SponsoredBy sponsors={sponsors} />}
          </div>
          {/* the night sky melts into pink clouds above the rules (a light section) */}
          <CloudEdge />
        </section>
      )}

      <section className="section light">
        <div className="wrap">
          <div className="head-row" data-reveal>
            <h2 className="display d-m">Rules</h2>
          </div>
          <div className={x.rules} data-notes={rules.notes.length > 0}>
            <div className={x.rulesMain} data-reveal="left">
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
              <ul className={x.notes} data-reveal-stagger>
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
