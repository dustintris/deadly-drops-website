'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/admin/actions'
import { can, type Area, type Principal } from '@/lib/auth/permissions'

type NavItem = { href: string; label: string; area?: Area }

/** Menu groups; an item with an area shows only to people who may view that area. */
const NAV: { group?: string; items: NavItem[] }[] = [
  { items: [{ href: '/admin/', label: 'Dashboard' }] },
  {
    group: 'Most used',
    items: [
      { href: '/admin/tournaments/', label: 'Tournaments', area: 'tournaments' },
      { href: '/admin/score/', label: 'Scoring', area: 'scoring' },
      { href: '/admin/announcements/', label: 'Announcements', area: 'content' },
      { href: '/admin/products/', label: 'Shop & prices', area: 'shop' },
      { href: '/admin/media/', label: 'Photos', area: 'content' },
      { href: '/admin/community/', label: 'Community & news', area: 'content' },
    ],
  },
  {
    group: 'Site',
    items: [
      { href: '/admin/gallery/', label: 'Gallery', area: 'content' },
      { href: '/admin/pages/', label: 'Page text', area: 'content' },
      { href: '/admin/settings/', label: 'Club info', area: 'content' },
      { href: '/admin/faqs/', label: 'FAQ', area: 'content' },
      { href: '/admin/theme/', label: 'Colours', area: 'branding' },
      { href: '/admin/staff/', label: 'Staff', area: 'staff' },
    ],
  },
]

export type NavWho = Principal & { name: string; email: string }

/** Ask before leaving a screen with unsaved edits (useSection marks the page). */
function guard(e: React.MouseEvent) {
  if (document.body.dataset.unsaved && !window.confirm('You have unsaved changes on this screen. Leave without saving?')) e.preventDefault()
}

export function AdminNav({ who }: { who: NavWho }) {
  const path = usePathname() || '/admin/'
  const active = (href: string) => (href === '/admin/' ? path === '/admin' || path === '/admin/' : path.startsWith(href.replace(/\/$/, '')))
  // hide what this person can't open (the pages check again on the server), and any group left empty
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((n) => !n.area || can(who, n.area, 'view')) })).filter((g) => g.items.length)
  return (
    <nav className="adm-side" aria-label="Admin">
      <div className="brand"><img src="/logo.png" alt="" />Deadly Drops</div>
      {groups.map((g) => (
        <div key={g.group ?? g.items[0].href} style={{ display: 'contents' }}>
          {g.group && <p className="group">{g.group}</p>}
          {g.items.map((n) => (
            <Link key={n.href} href={n.href} onClick={guard} aria-current={active(n.href) ? 'page' : undefined}>{n.label}</Link>
          ))}
        </div>
      ))}
      <div className="bottom">
        <a href="/" target="_blank" rel="noopener">View live site ↗</a>
        <p title={who.email} style={{ padding: '10px 12px 2px', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span className="sr">Signed in as </span>{who.name || who.email}
        </p>
        <Link href="/admin/account/" onClick={guard} aria-current={active('/admin/account/') ? 'page' : undefined}>My account</Link>
        <form action={logout}><button className="link">Sign out</button></form>
      </div>
    </nav>
  )
}
