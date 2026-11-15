import { redirect } from 'next/navigation'
import { adminConfigured, getSession } from '@/lib/auth/session'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await getSession()) redirect('/admin/')
  return (
    <main className="adm-login">
      <div className="adm-card" style={{ width: 'min(440px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="" width={48} height={48} style={{ background: 'var(--logo-plate)', borderRadius: 8, padding: 2, objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: 28 }}>Club admin</h1>
            <p className="adm-muted">Deadly Drops Pickleball</p>
          </div>
        </div>
        {adminConfigured() ? (
          <LoginForm />
        ) : (
          <p role="alert">
            The admin login is not set up on this server yet. In the <code>web</code> folder run <code>npm run admin:setup</code>,
            then restart the site.
          </p>
        )}
      </div>
    </main>
  )
}
