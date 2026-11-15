'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Division, Member } from '@/lib/types'
import { Monogram } from './Monogram'
import styles from './members.module.css'

const FILTERS: ('All' | Division)[] = ['All', '2.5', '3.0', '3.5', '4.0', '4.5+']

export function MemberDirectory({ members }: { members: Member[] }) {
  const [div, setDiv] = useState<'All' | Division>('All')
  const [q, setQ] = useState('')
  const list = members.filter((m) => (div === 'All' || m.division === div) && m.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <div className={styles.tools}>
        <div className="chips" role="group" aria-label="Filter by division">
          {FILTERS.map((f) => (
            <button key={f} className="chip" aria-pressed={f === div} onClick={() => setDiv(f)}>{f}</button>
          ))}
        </div>
        <label className={styles.search}>
          <span className="sr">Search members</span>
          <input className="input" type="search" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <p className="mono small muted" aria-live="polite" style={{ marginBottom: 16 }}>{list.length} of {members.length} members</p>
      {list.length ? (
        <ul className={styles.grid}>
          {list.map((m) => (
            <li key={m.slug}>
              <Link href={`/members/${m.slug}/`} className={`card card-link ${styles.card}`}>
                <div className={styles.tile}>
                  <Monogram member={m} />
                  <span className="badge">{m.rating.toFixed(2)}</span>
                </div>
                <div className={styles.body}>
                  <strong>{m.name}</strong>
                  <span className="mono">{m.division} · {m.yearsInClub}Y</span>
                  <p>{m.style}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p>No members match “{q}” in {div === 'All' ? 'any division' : `division ${div}`}.</p>
          <button className="btn btn-line btn-sm" onClick={() => { setQ(''); setDiv('All') }}>Clear filters</button>
        </div>
      )}
    </>
  )
}
