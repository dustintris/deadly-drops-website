import Link from 'next/link'
import type { Profile } from '@/lib/data'
import { Monogram } from './Monogram'
import styles from './members.module.css'

/** Player dashboard (members directory → profile, and the "Me" screen). */
export function Dashboard({ p, isMe = false }: { p: Profile; isMe?: boolean }) {
  const { member: m } = p
  const lo = Math.min(...p.trend) - 0.05
  const hi = Math.max(...p.trend)
  return (
    <div className={styles.dash}>
      <header className={styles.dashHead}>
        <div className={styles.dashAvatar}><Monogram member={m} round /></div>
        <div>
          <h1 className="display d-m">{m.name}</h1>
          <p className="mono small">{m.division} · Member since {m.memberSince} · #{p.ladderRank} on ladder</p>
        </div>
        <Link href="/tournaments/#register" className="btn btn-dark">{isMe ? 'Enter the next tournament' : `Challenge ${m.first}`}</Link>
      </header>

      <dl className={styles.kpis}>
        <div data-variant="dark"><dt>DUPR-style rating</dt><dd><strong>{m.rating.toFixed(2)}</strong><span>{p.ratingDelta >= 0 ? '▲' : '▼'} {Math.abs(p.ratingDelta).toFixed(2)} this month</span></dd></div>
        <div><dt>Season record</dt><dd><strong>{p.record}</strong><span>{p.winStreak} match win streak</span></dd></div>
        <div><dt>Sessions played</dt><dd><strong>{p.sessions}</strong><span>This season</span></dd></div>
        <div data-variant="accent"><dt>Upcoming events</dt><dd><strong>{p.upcoming}</strong><span>Next: ladder night</span></dd></div>
      </dl>

      <div className={styles.dashRow}>
        <figure className={styles.trend}>
          <figcaption className="eyebrow">Rating trend · 12 weeks</figcaption>
          <ol aria-label={`Rating from ${p.trend[0].toFixed(2)} to ${p.trend[11].toFixed(2)}`}>
            {p.trend.map((v, i) => (
              <li key={i} style={{ height: `${Math.max(8, ((v - lo) / (hi - lo || 1)) * 100)}%` }} title={v.toFixed(2)} data-last={i === 11} />
            ))}
          </ol>
          <div className={styles.trendAxis}><span>12 wks ago</span><span>{p.trend[11].toFixed(2)} now</span></div>
        </figure>
        <div className={styles.matches}>
          <p className="eyebrow">{isMe ? 'Your next matches' : 'Next matches'}</p>
          <ul>
            {p.nextMatches.map((x) => (
              <li key={x.title}><b className="display">{x.day}</b><span><strong>{x.title}</strong><small>{x.sub}</small></span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.results}>
        <p className="eyebrow">Recent results</p>
        <ul>
          {p.results.map((r) => (
            <li key={r.date}>
              <b data-win={r.result === 'W'}>{r.result}</b>
              <span><strong>vs. {r.opponents}</strong><small>{r.date}</small></span>
              <em>{r.score}</em>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
