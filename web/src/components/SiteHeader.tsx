'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { asset } from '@/lib/utils'
import { useCart } from './CartContext'
import styles from './shell.module.css'

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about/', label: 'About us' },
  { href: '/shop/', label: 'Shop' },
  { href: '/tournaments/', label: 'Tournaments' },
  { href: '/gallery/', label: 'Gallery' },
  { href: '/contact/', label: 'Contact us' },
]

export const isActive = (path: string, href: string) =>
  href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, ''))

export function SiteHeader({ city }: { city: string }) {
  const path = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const { count } = useCart()
  const inShop = path.startsWith('/shop') || path.startsWith('/cart')
  const current = NAV.find((n) => n.href !== '/' && isActive(path, n.href))

  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.headerRow}`}>
        <Link href="/" className={styles.brand} aria-label="Deadly Drops Pickleball home">
          <img src={asset('/logo.png')} alt="" width={46} height={46} />
          <span>
            <strong>Deadly Drops</strong>
            <small>{city}</small>
          </span>
        </Link>

        <span className={styles.mobileTitle} aria-hidden="true">{current ? current.label : 'Deadly Drops'}</span>

        <nav aria-label="Main" className={styles.nav}>
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={isActive(path, n.href) ? 'page' : undefined}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <Link href="/login/" className={styles.login}>Log in</Link>
          {inShop ? (
            <Link href="/cart/" className="btn btn-accent btn-sm" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>Cart · {count}</Link>
          ) : (
            <Link href="/signup/" className="btn btn-accent btn-sm">Sign up to play</Link>
          )}
        </div>

        <button
          className={styles.menuBtn}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr">{open ? 'Close menu' : 'Open menu'}</span>
          <span aria-hidden="true">{open ? '✕' : '≡'}</span>
        </button>
      </div>

      <div id="mobile-menu" className={styles.mobileMenu} hidden={!open}>
        <ul className="wrap">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={isActive(path, n.href) ? 'page' : undefined}>{n.label}</Link>
            </li>
          ))}
          <li><Link href="/members/">Members</Link></li>
          <li><Link href="/cart/">Cart ({count})</Link></li>
          <li className={styles.menuCtas}>
            <Link href="/login/" className="btn btn-ghost">Log in</Link>
            <Link href="/signup/" className="btn btn-accent">Sign up to play</Link>
          </li>
        </ul>
      </div>
      <p className="sr" role="status" aria-atomic="true">{count} {count === 1 ? 'item' : 'items'} in cart</p>
    </header>
  )
}
