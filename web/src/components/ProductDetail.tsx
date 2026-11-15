'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Product } from '@/lib/types'
import { money } from '@/lib/utils'
import { useCart } from './CartContext'
import { ProductArt } from './ProductArt'
import styles from './shop.module.css'

export function ProductDetail({ product, discount }: { product: Product; discount: number }) {
  const opts = product.options ?? []
  const [picked, setPicked] = useState<string[]>(opts.map((o) => o.values[Math.min(1, o.values.length - 1)]))
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { add } = useCart()
  const variant = picked.length ? picked.join(' · ') : product.sub

  return (
    <div className={styles.detail}>
      <ProductArt product={product} large />
      <div className={styles.detailBody}>
        <p className="eyebrow">{product.category}{product.tag === 'MEMBER' ? ' · best seller' : ''}</p>
        <h1 className="display d-l">{product.name}</h1>
        <p className={styles.price}>
          <strong>{money(product.price)}</strong>
          <span className="mono">{money(product.price * (1 - discount), true)} for members</span>
        </p>
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
            <button type="button" onClick={() => setQty((q) => Math.min(9, q + 1))} aria-label="Increase quantity">+</button>
          </div>
          <button
            className="btn btn-dark"
            style={{ flex: 1 }}
            onClick={() => {
              add({ slug: product.slug, name: product.name, variant, unit: product.price }, qty)
              setAdded(true)
            }}
          >
            Add to cart · {money(product.price * qty)}
          </button>
        </div>
        {added && (
          <p className={styles.addedNote} role="status">
            Added {qty} × {product.name} ({variant}). <Link href="/cart/">View cart</Link>
          </p>
        )}
        <ul className="chips" style={{ listStyle: 'none', padding: 0 }}>
          <li className="tag">Free pickup at the courts</li>
          <li className="tag">30-day returns</li>
        </ul>
      </div>
    </div>
  )
}
