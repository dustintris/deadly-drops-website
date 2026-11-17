import { redirect } from 'next/navigation'
import { getSession, loginAvailable } from '@/lib/auth/session'
import { readPublished } from '@/lib/store/content-store'
import { asset } from '@/lib/utils'
import { DEFAULT_LOGO, themeLogo } from '@/theme/tokens'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await getSession()) redirect('/admin/')
  // the live club logo (Admin → Logo & colours); the sign-in page must still work if that read fails
  const logo = await readPublished().then((c) => themeLogo(c.theme), () => ({ ...DEFAULT_LOGO }))
  return (
    <main className="adm-login">
      <div className="adm-card" style={{ width: 'min(440px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={asset(logo.src)} alt="" width={48} height={48} style={{ background: 'var(--logo-plate)', borderRadius: '50%', padding: 2, objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: 28 }}>Club admin</h1>
            <p className="adm-muted">Deadly Drops Pickleball</p>
          </div>
        </div>
        {(await loginAvailable()) ? (
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
