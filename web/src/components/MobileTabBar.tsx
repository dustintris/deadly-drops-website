'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './shell.module.css'

// the site is about the tournaments and the causes they play for; Members is still in the menu and footer
const TABS = [
  { href: '/', label: 'Home', match: (p: string) => p === '/' },
  { href: '/tournaments/', label: 'Events', match: (p: string) => p.startsWith('/tournaments') },
  { href: '/charity/', label: 'Charity', match: (p: string) => p.startsWith('/charity') },
  { href: '/shop/', label: 'Shop', match: (p: string) => p.startsWith('/shop') || p.startsWith('/cart') },
  { href: '/me/', label: 'Me', match: (p: string) => p.startsWith('/me') || p.startsWith('/login') || p.startsWith('/signup') },
]

/** Phone-only bottom navigation from the mobile mockups. */
export function MobileTabBar() {
  const path = usePathname() || '/'
  return (
    <nav className={styles.tabbar} aria-label="Quick">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.match(path) ? 'page' : undefined} data-burst>
          <span aria-hidden="true">✦</span>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
