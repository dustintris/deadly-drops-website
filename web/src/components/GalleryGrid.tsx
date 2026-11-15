'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryItem } from '@/lib/types'
import { asset } from '@/lib/utils'
import styles from './gallery.module.css'

const ALBUMS = ['All', 'Tournaments', 'Ladder', 'Clinics', 'Socials'] as const

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [album, setAlbum] = useState<(typeof ALBUMS)[number]>('All')
  const [open, setOpen] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const list = album === 'All' ? items : items.filter((g) => g.album === album)
  const cur = open === null ? null : list[open]

  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + list.length) % list.length)), [list.length])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open !== null && !el.open) el.showModal()
    if (open === null && el.open) el.close()
  }, [open])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, step])

  return (
    <>
      <div className={styles.bar}>
        <div className="chips" role="group" aria-label="Albums">
          {ALBUMS.map((a) => (
            <button key={a} className="chip" aria-pressed={a === album} onClick={() => { setAlbum(a); setOpen(null) }}>{a}</button>
          ))}
        </div>
        <p className="mono small muted" aria-live="polite">{list.length} photos</p>
      </div>

      <ul className={styles.grid}>
        {list.map((g, i) => (
          <li key={g.id} data-wide={g.wide}>
            <button className={`photo ${styles.tile}`} onClick={() => setOpen(i)} aria-label={`Open photo: ${g.caption}`}>
              <img src={asset(g.src)} alt="" style={{ objectPosition: g.position }} loading="lazy" />
              <span className={styles.cap}><strong>{g.caption}</strong><small>{g.meta}</small></span>
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <p className="muted">No photos in this album yet.</p>}

      <dialog ref={dialog} className={styles.lightbox} onClose={() => setOpen(null)} aria-label="Photo viewer">
        {cur && (
          <div className={styles.lbInner}>
            <div className={styles.lbPhoto}>
              <img src={asset(cur.src)} alt={cur.caption} />
              <button className={styles.lbPrev} onClick={() => step(-1)} aria-label="Previous photo">←</button>
              <button className={styles.lbNext} onClick={() => step(1)} aria-label="Next photo">→</button>
            </div>
            <div className={styles.lbSide}>
              <p className="eyebrow">{cur.album} · {(open ?? 0) + 1} / {list.length}</p>
              <h2 className="display d-s">{cur.caption}</h2>
              <p className="muted small">{cur.meta}</p>
              <dl>
                <div><dt>Shot by</dt><dd>{cur.shotBy ?? 'Club member'}</dd></div>
                <div><dt>Album</dt><dd>{cur.album}</dd></div>
              </dl>
              <button className="btn btn-line btn-sm" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}
