'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ClubEvent } from '@/lib/types'
import { eventCta, type EventState } from '@/lib/events'
import { asset, cx, money } from '@/lib/utils'
import { Monogram } from './Monogram'
import type { Member } from '@/lib/types'
import page from './tournament.module.css'
import styles from './tournaments.module.css'

type Champion = { event: string; pair: string; detail: string; lead: Member }

export function SeasonList({ events, states, champions }: { events: ClubEvent[]; states: Record<string, EventState>; champions: Champion[] }) {
  const withState = events.map((e) => ({ e, st: states[e.slug] ?? 'tba' }))
  const upcoming = withState.filter((x) => x.st !== 'past')
  const past = withState.filter((x) => x.st === 'past').sort((a, b) => (b.e.date ?? '').localeCompare(a.e.date ?? ''))
  const [tab, setTab] = useState<'upcoming' | 'past'>(upcoming.length ? 'upcoming' : 'past')
  return (
    <>
      <div className="head-row">
        <div className="stack-8" data-reveal>
          <p className="eyebrow">Tournaments</p>
          <h2 className="display d-m">{tab === 'upcoming' ? 'Pick your weekend' : 'Past tournaments'}</h2>
        </div>
        <div className="chips" role="group" aria-label="Show">
          <button className="chip" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming</button>
          <button className="chip" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>Past tournaments</button>
        </div>
      </div>

      {tab === 'upcoming' ? (
        <ul className={styles.season} data-reveal-stagger>
          {upcoming.map(({ e, st }) => {
            const d = e.date ? new Date(`${e.date}T12:00:00`) : null
            const cta = eventCta(e, st)
            return (
              <li key={e.slug} className="card">
                <div className={styles.date}>
                  <strong>{d ? String(d.getDate()).padStart(2, '0') : 'TBA'}</strong>
                  <span>{d ? d.toLocaleString('en-US', { month: 'short' }) : 'Date soon'}</span>
                </div>
                <div className={cx(styles.seasonBody, e.logo && page.withBadge)}>
                  {e.logo && <img className={page.logoBadge} src={asset(e.logo.src)} alt="" width={48} height={48} />}
                  <div>
                    <h3><Link href={`/tournaments/${e.slug}/`} className={page.nameLink}>{e.name}</Link></h3>
                    <p>{e.format} · {e.includes.join(' · ')}</p>
                  </div>
                </div>
                <span className="tag">{money(e.entryFee)}{e.entryFeeWithMeal ? ` / ${money(e.entryFeeWithMeal)}` : ''}</span>
                {cta.external ? (
                  <a href={cta.href} className="btn btn-accent btn-sm" target="_blank" rel="noopener noreferrer">{st === 'open' ? 'Register' : cta.label} <span className="sr">for {e.name} on Main Court (opens in a new tab)</span></a>
                ) : (
                  <Link href={cta.href} className="btn btn-accent btn-sm">{cta.label}<span className="sr"> for {e.name}</span></Link>
                )}
              </li>
            )
          })}
          {!upcoming.length && <li className={styles.more}>No tournament is scheduled right now.</li>}
          <li className={styles.more}>New tournaments are announced by email. Join the list in the footer to hear first.</li>
        </ul>
      ) : (
        <>
        <ul className={styles.season} data-reveal-stagger>
          {past.map(({ e }) => {
            const d = e.date ? new Date(`${e.date}T12:00:00`) : null
            return (
              <li key={e.slug} className="card">
                <div className={styles.date}>
                  <strong>{d ? String(d.getDate()).padStart(2, '0') : '–'}</strong>
                  <span>{d ? d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) : ''}</span>
                </div>
                <div className={cx(styles.seasonBody, e.logo && page.withBadge)}>
                  {e.logo && <img className={page.logoBadge} src={asset(e.logo.src)} alt="" width={48} height={48} />}
                  <div>
                    <h3><Link href={`/tournaments/${e.slug}/`} className={page.nameLink}>{e.name}</Link></h3>
                    <p>{e.dateLabel}{e.location ? ` · ${e.location}` : ''}</p>
                  </div>
                </div>
                {/* a tournament that's over shows no entry price, only its top prize */}
                {e.prizes.length > 0 && <span className="tag">Gold {money(e.prizes[0].amount)}</span>}
                <Link href="/community/" className="btn btn-line btn-sm">Photos &amp; stories<span className="sr"> from {e.name}</span></Link>
              </li>
            )
          })}
        </ul>
        <p className="eyebrow" style={{ margin: '32px 0 12px' }}>Division champions</p>
        <ul className={styles.champs} data-reveal-stagger>
          {champions.map((c) => (
            <li key={c.event} className="card">
              <Monogram member={c.lead} size="xl" round />
              <div>
                <p className="eyebrow">{c.event} · last season</p>
                <strong>{c.pair}</strong>
                <span>{c.detail}</span>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </>
  )
}
