'use client'

import Link from 'next/link'
import { useState } from 'react'
import { money } from '@/lib/utils'
import { useCart } from './CartContext'
import styles from './shop.module.css'

export function CartView({ discount }: { discount: number }) {
  const { lines, count, subtotal, setQty, remove, clear } = useCart()
  const [member, setMember] = useState(true)
  const [placed, setPlaced] = useState(false)
  const off = member ? Math.round(subtotal * discount * 100) / 100 : 0
  const total = subtotal - off

  if (placed) {
    return (
      <div className={styles.placed} role="status">
        <p className="eyebrow">Order placed · preview</p>
        <h1 className="display d-m">See you at the courts</h1>
        <p className="muted">
          In the live site this is where payment happens. Nothing was charged: this preview has no checkout connected.
        </p>
        <Link href="/shop/" className="btn btn-accent">Back to the shop</Link>
      </div>
    )
  }

  if (!lines.length) {
    return (
      <div className={styles.placed}>
        <h1 className="display d-m">Your cart is empty</h1>
        <p className="muted">Paddles, club kit and the small stuff you forgot in the car.</p>
        <Link href="/shop/" className="btn btn-accent">Browse the shop</Link>
      </div>
    )
  }

  return (
    <div className={styles.cart}>
      <div>
        <h1 className="display d-m">Your cart <small className="mono muted">{count} items</small></h1>
        <ul className={styles.lines}>
          {lines.map((l) => (
            <li key={l.slug + l.variant} className="card">
              <div>
                <Link href={`/shop/${l.slug}/`}><strong>{l.name}</strong></Link>
                <small>{l.variant}</small>
              </div>
              <div className={styles.qty} role="group" aria-label={`Quantity of ${l.name}`}>
                <button onClick={() => setQty(l.slug, l.variant, l.qty - 1)} aria-label="Decrease">−</button>
                <output>{l.qty}</output>
                <button onClick={() => setQty(l.slug, l.variant, l.qty + 1)} aria-label="Increase">+</button>
              </div>
              <b>{money(l.qty * l.unit)}</b>
              <button className={styles.remove} onClick={() => remove(l.slug, l.variant)} aria-label={`Remove ${l.name}`}>Remove</button>
            </li>
          ))}
        </ul>
        <button className="link-arrow" onClick={clear} style={{ marginTop: 20 }}>Empty cart</button>
      </div>

      <aside className={styles.summary} aria-label="Order summary">
        <p className="eyebrow">Order summary</p>
        <dl>
          <div><dt>Subtotal</dt><dd>{money(subtotal, true)}</dd></div>
          <div className={styles.disc}><dt>Member discount ({Math.round(discount * 100)}%)</dt><dd>{member ? `−${money(off, true)}` : '—'}</dd></div>
          <div><dt>Pickup or delivery</dt><dd>Arranged with the club</dd></div>
        </dl>
        <label className={styles.memberToggle}>
          <input type="checkbox" checked={member} onChange={(e) => setMember(e.target.checked)} />
          I'm a logged-in member
        </label>
        <div className={styles.total}><span>Total</span><strong>{money(total, true)}</strong></div>
        <button className="btn btn-accent btn-block" onClick={() => setPlaced(true)}>Checkout</button>
        <p className="small muted">Or pay at the table on event day.</p>
      </aside>
    </div>
  )
}
