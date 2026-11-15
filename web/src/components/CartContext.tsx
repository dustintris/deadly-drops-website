'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type CartLine = { slug: string; name: string; variant: string; unit: number; qty: number }

type Cart = {
  lines: CartLine[]
  count: number
  subtotal: number
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void
  setQty: (slug: string, variant: string, qty: number) => void
  remove: (slug: string, variant: string) => void
  clear: () => void
}

const CartCtx = createContext<Cart | null>(null)
const KEY = 'dd-cart-v1'

/* Example basket so the cart screen is never empty in the preview. */
const STARTER: CartLine[] = [
  { slug: 'club-paddle', name: 'Club Paddle', variant: '4 ¼" grip · lime edge', unit: 149, qty: 1 },
  { slug: 'deadly-drops-tee', name: 'Deadly Drops Tee', variant: 'Medium · lime on black', unit: 32, qty: 2 },
  { slug: 'grip-tape-3-pack', name: 'Grip Tape 3-pack', variant: 'Tacky lime', unit: 14, qty: 1 },
]

/**
 * Client-side cart for the clickable preview, kept in localStorage.
 * Production: replace with a server cart / checkout provider (e.g. Stripe).
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(STARTER)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (saved) setLines(JSON.parse(saved) as CartLine[])
    } catch { /* storage unavailable: keep the starter basket */ }
  }, [])

  const persist = useCallback((next: CartLine[]) => {
    setLines(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  const value = useMemo<Cart>(() => {
    const same = (l: CartLine, slug: string, variant: string) => l.slug === slug && l.variant === variant
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * l.unit, 0),
      add: (line, qty = 1) => {
        const hit = lines.find((l) => same(l, line.slug, line.variant))
        persist(hit ? lines.map((l) => (l === hit ? { ...l, qty: Math.min(9, l.qty + qty) } : l)) : [...lines, { ...line, qty }])
      },
      setQty: (slug, variant, qty) =>
        persist(qty < 1 ? lines.filter((l) => !same(l, slug, variant)) : lines.map((l) => (same(l, slug, variant) ? { ...l, qty: Math.min(9, qty) } : l))),
      remove: (slug, variant) => persist(lines.filter((l) => !same(l, slug, variant))),
      clear: () => persist([]),
    }
  }, [lines, persist])

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>
}

export function useCart(): Cart {
  const ctx = useContext(CartCtx)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
