'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryItem } from '@/lib/types'
import { asset } from '@/lib/utils'
import { GalleryCarousel } from './GalleryCarousel'
import styles from './gallery.module.css'

const ORDER = ['Tournaments', 'Community', 'Socials', 'Ladder', 'Clinics'] as const
type Album = 'All' | GalleryItem['album']

/**
 * `initialAlbum` (from /gallery/?album=…, e.g. a tournament's "See all the photos") opens on that album when it has photos.
 * `carousel` puts the featured photos above the grid (the Gallery page); the album chips and the photo viewer serve both.
 */
export function GalleryGrid({ items, initialAlbum, carousel = false }: { items: GalleryItem[]; initialAlbum?: string; carousel?: boolean }) {
  // only offer albums that have photos; hide the chips when there is just one
  const albums: Album[] = ['All', ...ORDER.filter((a) => items.some((g) => g.album === a))]
  const [album, setAlbum] = useState<Album>(() => albums.find((a) => a !== 'All' && a === initialAlbum) ?? 'All')
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
          {albums.length > 2 && albums.map((a) => (
            <button key={a} className="chip" aria-pressed={a === album} onClick={() => { setAlbum(a); setOpen(null) }}>{a}</button>
          ))}
        </div>
        <p className="mono small muted" aria-live="polite">{list.length} photos</p>
      </div>

      {carousel && <GalleryCarousel items={list} album={album} onOpen={setOpen} held={open !== null} />}

      <ul className={styles.grid} data-reveal-stagger="zoom">
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
