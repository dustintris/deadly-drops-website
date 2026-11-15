'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '@/lib/types'
import { asset, money } from '@/lib/utils'
import { useCart } from './CartContext'
import { ProductArt } from './ProductArt'
import styles from './shop.module.css'

export function ProductDetail({ product, discount, pickupNote }: { product: Product; discount: number; pickupNote?: string }) {
  const opts = product.options ?? []
  const [picked, setPicked] = useState<string[]>(opts.map((o) => o.values[Math.min(1, o.values.length - 1)]))
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { add } = useCart()
  const photos = (product.images ?? []).filter((img) => img.src)
  const [shown, setShown] = useState(0)
  const soldOut = product.stock === 0
  const low = typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5 ? product.stock : null
  const maxQty = typeof product.stock === 'number' && product.stock > 0 ? Math.min(9, product.stock) : 9
  const variant = picked.length ? picked.join(' · ') : product.sub

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
        <p className={styles.price}>
          <strong>{money(product.price)}</strong>
          <span className="mono">{money(product.price * (1 - discount), true)} for members</span>
        </p>
        {soldOut ? (
          <p><span className={styles.soldOut}>Sold out</span></p>
        ) : low !== null ? (
          <p className={styles.stockNote}><span className={styles.lowStock}>Only {low} left</span></p>
        ) : null}
        <p className="muted">{product.description ?? `${product.sub}. Pick it up at the courts on event day.`}</p>

        {opts.map((o, oi) => (
          <fieldset key={o.label} className={styles.opt}>
            <legend className="label">{o.label}</legend>
            <div className="chips">
              {o.values.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="chip"
                  aria-pressed={picked[oi] === v}
                  onClick={() => setPicked((p) => p.map((x, i) => (i === oi ? v : x)))}
                >
                  {v}
                </button>
              ))}
            </div>
          </fieldset>
        ))}

        <div className={styles.buyRow}>
          <div className={styles.qty} role="group" aria-label="Quantity">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
            <output aria-live="polite">{qty}</output>
            <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity">+</button>
          </div>
          <button
            className="btn btn-dark"
            style={{ flex: 1 }}
            disabled={soldOut}
            onClick={() => {
              if (soldOut) return
              add({ slug: product.slug, name: product.name, variant, unit: product.price }, qty)
              setAdded(true)
            }}
          >
            {soldOut ? 'Sold out' : `Add to cart · ${money(product.price * qty)}`}
          </button>
        </div>
        {added && (
          <p className={styles.addedNote} role="status">
            Added {qty} × {product.name} ({variant}). <Link href="/cart/">View cart</Link>
          </p>
        )}
        <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
          {pickupNote && <li className="tag">{pickupNote}</li>}
        </ul>
      </div>
    </div>
  )
}
