'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '@/lib/types'
import { money } from '@/lib/utils'
import { useCart } from './CartContext'
import { ProductArt } from './ProductArt'
import styles from './shop.module.css'

const CATS = ['All', 'Paddles', 'Apparel', 'Gear', 'Balls'] as const

export function ShopCatalogue({ products }: { products: Product[] }) {
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const [added, setAdded] = useState<string | null>(null)
  const { add } = useCart()
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
              {p.tag && <span className={`badge ${styles.itemTag}`}>{p.tag}</span>}
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
            <button
              className="btn btn-line btn-sm btn-block"
              disabled={p.stock === 0}
              onClick={() => {
                if (p.stock === 0) return
                add({ slug: p.slug, name: p.name, variant: p.options?.[0]?.values[1] ?? p.sub, unit: p.price })
                setAdded(p.slug)
                setTimeout(() => setAdded(null), 1600)
              }}
            >
              {p.stock === 0 ? 'Sold out' : added === p.slug ? 'Added to cart' : 'Add to cart'}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
