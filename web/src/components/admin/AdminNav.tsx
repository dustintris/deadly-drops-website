'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/admin/actions'

const NAV: { group?: string; href: string; label: string }[] = [
  { href: '/admin/', label: 'Dashboard' },
  { group: 'Most used', href: '/admin/events/', label: 'Tournaments' },
  { href: '/admin/announcements/', label: 'Announcements' },
  { href: '/admin/products/', label: 'Shop & prices' },
  { href: '/admin/media/', label: 'Photos' },
  { href: '/admin/community/', label: 'Community & news' },
  { group: 'Site', href: '/admin/gallery/', label: 'Gallery' },
  { href: '/admin/pages/', label: 'Page text' },
  { href: '/admin/settings/', label: 'Club info' },
  { href: '/admin/faqs/', label: 'FAQ' },
  { href: '/admin/theme/', label: 'Colours' },
]

export function AdminNav({ email }: { email: string }) {
  const path = usePathname() || '/admin/'
  const active = (href: string) => (href === '/admin/' ? path === '/admin' || path === '/admin/' : path.startsWith(href.replace(/\/$/, '')))
  return (
    <nav className="adm-side" aria-label="Admin">
      <div className="brand"><img src="/logo.png" alt="" />Deadly Drops</div>
      {NAV.map((n) => (
        <div key={n.href} style={{ display: 'contents' }}>
          {n.group && <p className="group">{n.group}</p>}
          <Link href={n.href} aria-current={active(n.href) ? 'page' : undefined}>{n.label}</Link>
        </div>
      ))}
      <div className="bottom">
        <a href="/" target="_blank" rel="noopener">View live site ↗</a>
        <form action={logout}><button className="link" title={email}>Sign out</button></form>
      </div>
    </nav>
  )
}
