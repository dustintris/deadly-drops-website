'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ClubEvent } from '@/lib/types'
import { money } from '@/lib/utils'
import { Monogram } from './Monogram'
import type { Member } from '@/lib/types'
import styles from './tournaments.module.css'

type Champion = { event: string; pair: string; detail: string; lead: Member }

export function SeasonList({ events, champions }: { events: ClubEvent[]; champions: Champion[] }) {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  return (
    <>
      <div className="head-row">
        <div className="stack-8">
          <p className="eyebrow">Season 2026</p>
          <h2 className="display d-m">Pick your weekend</h2>
        </div>
        <div className="chips" role="group" aria-label="Show">
          <button className="chip" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming</button>
          <button className="chip" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>Past results</button>
        </div>
      </div>

      {tab === 'upcoming' ? (
        <ul className={styles.season}>
          {events.map((e) => {
            const d = e.date ? new Date(e.date) : null
            return (
              <li key={e.slug} className="card">
                <div className={styles.date}>
                  <strong>{d ? String(d.getDate()).padStart(2, '0') : 'TBA'}</strong>
                  <span>{d ? d.toLocaleString('en-US', { month: 'short' }) : '2026'}</span>
                </div>
                <div className={styles.seasonBody}>
                  <h3>{e.name}</h3>
                  <p>{e.format} · {e.includes.join(' · ')}</p>
                </div>
                <span className="tag">{money(e.entryFee)}{e.entryFeeWithMeal ? ` / ${money(e.entryFeeWithMeal)}` : ''}</span>
                <Link href="#register" className="btn btn-accent btn-sm">Enter</Link>
              </li>
            )
          })}
          <li className={styles.more}>More 2026 events are announced by email. Join the list in the footer to hear first.</li>
        </ul>
      ) : (
        <ul className={styles.champs}>
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
      )}
    </>
  )
}
