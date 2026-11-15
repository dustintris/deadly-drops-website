'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Member } from '@/lib/types'
import { Monogram } from './Monogram'
import styles from './me.module.css'

type Props = { rank: number; tonight: { member: Member; note: string }[] }

/** "Tonight" panel of the member app. Check-in is local in the preview; production posts to the check-in API. */
export function TonightCard({ rank, tonight }: Props) {
  const [checked, setChecked] = useState(false)
  return (
    <div className={styles.tonight}>
      <p className="eyebrow">Tonight · 6:00 PM</p>
      <h2 className="display d-m">Ladder night<br />Courts 1–4</h2>
      <div className={styles.rank}>
        <p className="eyebrow">You&rsquo;re in · group B</p>
        <p><strong className="display">#{rank}</strong> <span>▲ 3 spots this week</span></p>
      </div>
      <p className="eyebrow">Who&rsquo;s playing tonight</p>
      <ul className={styles.players}>
        {tonight.map((t) => (
          <li key={t.member.slug}>
            <Link href={`/members/${t.member.slug}/`}>
              <Monogram member={t.member} size="sm" round />
              <span className={styles.who}><strong>{t.member.name}</strong><small>{t.note}</small></span>
              <b>{t.member.rating.toFixed(2)}</b>
            </Link>
          </li>
        ))}
      </ul>
      <button className={`${styles.checkin} ${checked ? styles.checked : ''}`} onClick={() => setChecked((c) => !c)} aria-pressed={checked}>
        {checked ? '✓ Checked in at the court' : 'Check in at the court'}
      </button>
    </div>
  )
}
