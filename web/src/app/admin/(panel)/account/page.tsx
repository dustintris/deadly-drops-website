import { AREA_HELP, AREA_LABELS, AREAS, PRESETS, presetOf, type Level } from '@/lib/auth/permissions'
import { requireAdmin } from '@/lib/auth/session'
import { AccountForm } from './AccountForm'

export const metadata = { title: 'My account' }
export const dynamic = 'force-dynamic'

const LEVEL_TEXT: Record<Level, string> = { none: 'No access', view: 'View only', edit: 'Can change' }

export default async function AccountAdmin() {
  const s = await requireAdmin() // each page checks: a layout check alone can be skipped by partial rendering
  const role = s.isOwner ? 'Owner' : (PRESETS.find((p) => p.key === presetOf(s.perms))?.label ?? 'Custom')
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>My account</h1>
          <p className="adm-muted">Your login, what you can do in the admin, and your password.</p>
        </div>
      </div>

      <section className="adm-card" aria-labelledby="acct-login-h">
        <h2 id="acct-login-h">Your login</h2>
        <dl className="adm-facts">
          <div><dt>Name</dt><dd>{s.name || 'Not set'}</dd></div>
          <div><dt>Email</dt><dd>{s.email}</dd></div>
          <div><dt>Role</dt><dd>{role}</dd></div>
        </dl>
      </section>

      <section className="adm-card" aria-labelledby="acct-access-h">
        <h2 id="acct-access-h">What you can do</h2>
        {s.isOwner ? (
          <p>Owner: full access to every area, including staff accounts.</p>
        ) : (
          <>
            <table className="adm-table adm-access-table">
              <caption className="sr">Your access to each area of the admin</caption>
              <thead>
                <tr><th scope="col">Area</th><th scope="col">Your access</th></tr>
              </thead>
              <tbody>
                {AREAS.map((a) => (
                  <tr key={a}>
                    <th scope="row">
                      {AREA_LABELS[a]}
                      <span className="adm-muted">{AREA_HELP[a]}</span>
                    </th>
                    <td>{LEVEL_TEXT[s.perms[a]]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="adm-muted">Need more access? Ask the owner, or whoever manages staff logins.</p>
          </>
        )}
      </section>

      <AccountForm isOwner={s.isOwner} email={s.email} />
    </>
  )
}
