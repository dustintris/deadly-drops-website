import type { Metadata } from 'next'
import { Clock, Rotator, ScreenControls } from '@/components/display/Rotator'
import s from '@/components/display.module.css'
import l from '@/components/live.module.css'
import { LiveRefresh } from '@/components/LiveRefresh'
import { DivisionResults } from '@/components/results/Results'
import { getClubLogo } from '@/lib/data'
import { loadDisplay } from '@/lib/display/access'
import { clubToday } from '@/lib/events'
import { courtBoard } from '@/lib/match/courts'
import { hasPlay, matchLabel } from '@/lib/match/present'
import { formatTime12 } from '@/lib/match/schedule'
import type { DivisionPlay, Match } from '@/lib/play/repo'
import { asset } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tournament } = await loadDisplay((await params).slug)
  return { title: `${tournament.name}: venue screen`, robots: { index: false, follow: false } }
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const int = (v: string | undefined) => (v && /^\d{1,9}$/.test(v) ? Number(v) : null)

/**
 * The venue screen for a projector or TV: every court's game now and next, and one division's
 * standings at a time. Full screen, no site menus, follows the tournament live.
 *  ?division=<id> shows only that division (a second screen) · ?day=<1..n> picks the day
 *  ?rotate=<seconds> changes how long each division stays up (default 15)
 */
export default async function DisplayPage({ params, searchParams }: Props) {
  const [{ slug }, q] = await Promise.all([params, searchParams])
  const { tournament: t, play } = await loadDisplay(slug)

  const days = play.days
  const dayParam = int(one(q.day))
  const todayIndex = days.indexOf(clubToday())
  const day = days.length > 1 ? (dayParam !== null && dayParam >= 1 && dayParam <= days.length ? dayParam - 1 : Math.max(0, todayIndex)) : 0
  const pinned = int(one(q.division))
  const rotate = Math.min(120, Math.max(5, int(one(q.rotate)) ?? 15))

  const onDay = (d: DivisionPlay) => days.length < 2 || Math.min(d.dayIndex, days.length - 1) === day
  const divisions = play.divisions
    .filter((d) => (pinned !== null ? d.id === pinned : onDay(d) && hasPlay(d)))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const courts = courtBoard(divisions)
  const names = new Map(divisions.flatMap((d) => d.teams.map((x) => [x.id, x.name] as const)))
  const logo = t.info.logo?.src ?? (await getClubLogo()).src // the tournament's logo, else the club's (Admin → Logo & colours)

  return (
    <div className={s.screen}>
      <header className={s.head}>
        <img className={s.logo} src={asset(logo)} alt="" width={72} height={72} />
        <div className={s.title}>
          <h1>{t.name}</h1>
          <p>{days.length > 1 ? `Day ${day + 1} · ` : ''}{t.info.dateLabel}{t.info.venue ? ` · ${t.info.venue.split(',')[0]}` : ''}</p>
        </div>
        <Clock />
        <div className={s.feed}><LiveRefresh tournamentId={play.id} version={play.liveVersion} /></div>
        <ScreenControls />
      </header>

      {divisions.length === 0 ? (
        <main className={s.waiting}>
          <p>Teams and matches will appear here on tournament day.</p>
        </main>
      ) : (
        <main className={s.main} data-courts={courts.length > 0} data-many={courts.length > 3}>
          {courts.length > 0 && (
            <section className={s.courts} aria-labelledby="courts-h">
              <h2 id="courts-h" className={s.label}>Courts</h2>
              <ol>
                {courts.map((c) => (
                  <li key={c.court} className={s.court} data-live={c.now !== null}>
                    <p className={s.courtNo}>
                      <span>Court</span> {c.court}
                      <em className={s.label}>{c.now ? <><span className="live-dot" aria-hidden="true" /> Live · {matchLabel(c.now)}</> : 'Free'}</em>
                    </p>
                    {c.now && <CourtGame m={c.now} names={names} />}
                    {c.next && (
                      <p className={s.next}>
                        <span className={s.label}>Next · {c.next.startsAt ? formatTime12(c.next.startsAt) : matchLabel(c.next)}</span>
                        <span className={s.nextTeams}>{teamName(c.next.teamAId, names)} <i>v</i> {teamName(c.next.teamBId, names)}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className={`${s.results} ${l.divisions}`} aria-label="Standings">
            <Rotator seconds={rotate} labels={divisions.map((d) => d.name)}>
              {divisions.map((d) => (
                <DivisionResults key={d.id} d={d} tiebreakers={play.rules.tiebreakers} day={days[d.dayIndex]} level={2} variant="board" />
              ))}
            </Rotator>
          </section>
        </main>
      )}
    </div>
  )
}

const teamName = (id: number | null, names: Map<number, string>) => (id !== null ? names.get(id) : undefined) ?? 'To be decided'

function CourtGame({ m, names }: { m: Match; names: Map<number, string> }) {
  return (
    <div className={s.game}>
      <p className={s.team}><span>{teamName(m.teamAId, names)}</span><strong>{m.scoreA ?? 0}</strong></p>
      <p className={s.team}><span>{teamName(m.teamBId, names)}</span><strong>{m.scoreB ?? 0}</strong></p>
    </div>
  )
}
