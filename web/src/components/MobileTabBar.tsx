'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './shell.module.css'

const TABS = [
  { href: '/', label: 'Play', match: (p: string) => p === '/' },
  { href: '/members/', label: 'Roster', match: (p: string) => p.startsWith('/members') },
  { href: '/tournaments/', label: 'Events', match: (p: string) => p.startsWith('/tournaments') },
  { href: '/shop/', label: 'Shop', match: (p: string) => p.startsWith('/shop') || p.startsWith('/cart') },
  { href: '/me/', label: 'Me', match: (p: string) => p.startsWith('/me') || p.startsWith('/login') || p.startsWith('/signup') },
]

/** Phone-only bottom navigation from the mobile mockups. */
export function MobileTabBar() {
  const path = usePathname() || '/'
  return (
    <nav className={styles.tabbar} aria-label="Quick">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.match(path) ? 'page' : undefined}>
          <span aria-hidden="true">◆</span>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
