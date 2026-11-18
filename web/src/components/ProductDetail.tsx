'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '@/lib/types'
import { asset, money } from '@/lib/utils'
import { ProductArt } from './ProductArt'
import styles from './shop.module.css'

/** One product in the catalogue: photos, price, what it comes in, and how to buy it (no online checkout). */
export function ProductDetail({ product, pickupNote }: { product: Product; pickupNote?: string }) {
  const opts = (product.options ?? []).filter((o) => o.values.length > 0)
  const photos = (product.images ?? []).filter((img) => img.src)
  const [shown, setShown] = useState(0)
  const soldOut = product.stock === 0
  const low = typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5 ? product.stock : null
  const askHref = `/contact/?about=${encodeURIComponent(product.name)}`

  return (
    <div className={styles.detail}>
      <div className={styles.gallery}>
        <ProductArt product={product} large image={photos[shown]} />
        {photos.length > 1 && (
          <ul className={styles.thumbs} aria-label="Product photos">
            {photos.map((img, i) => (
              <li key={img.src + i}>
                <button type="button" aria-pressed={i === shown} aria-label={`Show photo ${i + 1} of ${photos.length}${img.alt ? `: ${img.alt}` : ''}`} onClick={() => setShown(i)}>
                  <img src={asset(img.src)} alt="" style={{ objectPosition: img.position }} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.detailBody}>
        <p className="eyebrow">{product.category}{product.tag === 'MEMBER' ? ' · best seller' : ''}</p>
        <h1 className="display d-l">{product.name}</h1>
        <p className={styles.price}><strong>{money(product.price)}</strong></p>
        {soldOut ? (
          <p><span className={styles.soldOut}>Sold out</span></p>
        ) : low !== null ? (
          <p className={styles.stockNote}><span className={styles.lowStock}>Only {low} left</span></p>
        ) : null}
        <p className="muted">{product.description ?? `${product.sub}. Pick it up at the courts on event day.`}</p>

        {opts.length > 0 && (
          <dl className={styles.opts}>
            {opts.map((o) => (
              <div key={o.label}>
                <dt className="label">{o.label}</dt>
                <dd>Available in: {o.values.join(' · ')}</dd>
              </div>
            ))}
          </dl>
        )}

        <section className={styles.buy} aria-labelledby="how-to-buy">
          <h2 id="how-to-buy" className="eyebrow">How to buy</h2>
          {pickupNote && <p>{pickupNote}</p>}
          <Link href={askHref} className={`btn btn-dark ${styles.buyCta}`}>Message us about this item</Link>
        </section>
      </div>
    </div>
  )
}
