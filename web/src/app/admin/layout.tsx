import type { Metadata } from 'next'
import '@/components/admin/admin.css'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · Deadly Drops' },
  robots: { index: false, follow: false },
}

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>
}
