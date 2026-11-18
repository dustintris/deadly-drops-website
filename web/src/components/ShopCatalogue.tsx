'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '@/lib/types'
import { money } from '@/lib/utils'
import { ProductArt } from './ProductArt'
import styles from './shop.module.css'

const CATS = ['All', 'Paddles', 'Apparel', 'Gear', 'Balls'] as const

/* 'MEMBER' is the admin's "best seller" flag; spelled out so it never reads as a members-only price */
const TAG_LABEL: Record<NonNullable<Product['tag']>, string> = { NEW: 'NEW', MEMBER: 'BEST SELLER', LOW: 'LOW' }

/** The shop grid: a catalogue to browse, each card opening the product page (no cart). */
export function ShopCatalogue({ products }: { products: Product[] }) {
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const list = cat === 'All' ? products : products.filter((p) => p.category === cat)

  return (
    <>
      <div className={styles.filterBar}>
        <div className="chips" role="group" aria-label="Filter by category">
          {CATS.map((c) => (
            <button key={c} className="chip" aria-pressed={c === cat} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <p className="mono small muted" aria-live="polite">{list.length} items</p>
      </div>
      <ul className={styles.grid} data-reveal-stagger>
        {list.map((p) => (
          <li key={p.slug} className={`card ${styles.item}`}>
            <Link href={`/shop/${p.slug}/`} className={styles.itemLink}>
              <ProductArt product={p} />
              {p.tag && <span className={`badge ${styles.itemTag}`}>{TAG_LABEL[p.tag]}</span>}
              {p.stock === 0 ? (
                <span className={`${styles.soldOut} ${styles.itemStock}`}>Sold out</span>
              ) : typeof p.stock === 'number' && p.stock <= 5 ? (
                <span className={`${styles.lowStock} ${styles.itemStock}`}>Only {p.stock} left</span>
              ) : null}
              <span className={styles.itemHead}>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.sub}</small>
                </span>
                <b>{money(p.price)}</b>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
