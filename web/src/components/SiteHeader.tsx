'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { asset } from '@/lib/utils'
import { useCart } from './CartContext'
import styles from './shell.module.css'

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/tournaments/', label: 'Tournaments' },
  { href: '/charity/', label: 'Charity' },
  { href: '/shop/', label: 'Shop' },
  { href: '/community/', label: 'Community' },
  { href: '/gallery/', label: 'Gallery' },
  { href: '/about/', label: 'About us' },
  { href: '/contact/', label: 'Contact us' },
]

export const isActive = (path: string, href: string) =>
  href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, ''))

/** `logo` is the club logo's path (Admin → Logo & colours); the link's label names it, so the image itself is decorative. */
export function SiteHeader({ city, logo }: { city: string; logo: string }) {
  const path = usePathname() || '/'
  const [open, setOpen] = useState(false)
  // the menu icon only spins once the visitor has used the button
  const [toggled, setToggled] = useState(false)
  const { count } = useCart()
  const inShop = path.startsWith('/shop') || path.startsWith('/cart')
  const current = NAV.find((n) => n.href !== '/' && isActive(path, n.href))

  const [menuPath, setMenuPath] = useState(path)
  if (menuPath !== path) { setMenuPath(path); setOpen(false) } // close the menu after navigation
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
          <img src={asset(logo)} alt="" width={46} height={46} />
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
            <Link href="/tournaments/#register" className="btn btn-accent btn-sm">Register to play</Link>
          )}
        </div>

        <button
          className={styles.menuBtn}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => { setOpen((o) => !o); setToggled(true) }}
        >
          <span className="sr">{open ? 'Close menu' : 'Open menu'}</span>
          {/* keyed, so the icon spins in again each time it swaps (not when the page first loads) */}
          <span key={open ? 'close' : 'open'} className={styles.menuIcon} data-spin={toggled || undefined} aria-hidden="true">{open ? '✕' : '≡'}</span>
        </button>
      </div>

      <div id="mobile-menu" className={styles.mobileMenu} hidden={!open}>
        {/* any link closes the menu, also one to a spot on the same page (e.g. /tournaments/#register) */}
        <ul className="wrap" onClick={(e) => { if (e.target instanceof Element && e.target.closest('a')) setOpen(false) }}>
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={isActive(path, n.href) ? 'page' : undefined}>{n.label}</Link>
            </li>
          ))}
          <li><Link href="/members/">Members</Link></li>
          <li><Link href="/cart/">Cart ({count})</Link></li>
          <li className={styles.menuCtas}>
            <Link href="/login/" className="btn btn-ghost">Log in</Link>
            <Link href="/tournaments/#register" className="btn btn-accent">Register to play</Link>
          </li>
        </ul>
      </div>
      <p className="sr" role="status" aria-atomic="true">{count} {count === 1 ? 'item' : 'items'} in cart</p>
    </header>
  )
}
