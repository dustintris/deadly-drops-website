import type { Metadata } from 'next'
import Link from 'next/link'
import { PrintButton } from '@/components/display/PrintButton'
import s from '@/components/print.module.css'
import { DivisionResults } from '@/components/results/Results'
import { getClubLogo } from '@/lib/data'
import { loadDisplay } from '@/lib/display/access'
import { hasPlay } from '@/lib/match/present'
import { dayLabel } from '@/lib/tournaments/days'
import { asset } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tournament } = await loadDisplay((await params).slug)
  return { title: `${tournament.name}: results`, robots: { index: false, follow: true } }
}

/** Every division's standings and matches on paper: for the results table, the notice board or the club's records. */
export default async function PrintResults({ params }: Props) {
  const { slug } = await params
  const { tournament: t, play } = await loadDisplay(slug)
  const days = play.days
  const dayCount = Math.max(1, days.length)
  const byDay = Array.from({ length: dayCount }, (_, i) =>
    play.divisions.filter((d) => hasPlay(d) && Math.min(d.dayIndex, dayCount - 1) === i).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  )
  const any = byDay.some((ds) => ds.length > 0)
  const printed = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' })
  const logo = t.info.logo?.src ?? (await getClubLogo()).src // the tournament's logo, else the club's (Admin → Logo & colours)

  return (
    <div className={s.sheet}>
      <header className={s.head}>
        <img className={s.logo} src={asset(logo)} alt="" width={64} height={64} />
        <div className={s.title}>
          <h1>{t.name}: results</h1>
          <p>{t.info.dateLabel}{t.info.venue ? ` · ${t.info.venue}` : ''}</p>
        </div>
        <div className={s.actions}>
          {t.visible && <Link className={`${s.btn} ${s.ghost}`} href={`/tournaments/${t.slug}/`}>Back to the tournament</Link>}
          <PrintButton />
        </div>
      </header>

      {!any ? (
        <p className={s.empty}>No teams or matches yet.</p>
      ) : (
        byDay.map((ds, i) =>
          ds.length ? (
            <section key={i} aria-label={days.length > 1 ? `Day ${i + 1}` : undefined}>
              {days.length > 1 && <h2 className={s.day}>Day {i + 1} · {dayLabel(days[i])}</h2>}
              <div className={s.list}>
                {ds.map((d) => <DivisionResults key={d.id} d={d} tiebreakers={play.rules.tiebreakers} day={days[i]} level={days.length > 1 ? 3 : 2} variant="print" />)}
              </div>
            </section>
          ) : null,
        )
      )}
      <p className={s.printed}>Printed {printed} (Pacific). Standings count finished pool games only.</p>
    </div>
  )
}
