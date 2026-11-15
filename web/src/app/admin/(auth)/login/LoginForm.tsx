'use client'

import { useActionState } from 'react'
import { login } from '../../actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  return (
    <form action={action} className="adm-card" style={{ padding: 0, border: 0 }}>
      <div className="adm-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="adm-input" defaultValue={state?.email} key={state?.email} />
      </div>
      <div className="adm-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="adm-input" autoFocus={!!state} />
      </div>
      {state && !state.ok && <p role="alert" className="err" style={{ color: 'var(--danger-on-light)', fontWeight: 600 }}>{state.message}</p>}
      <button className="adm-btn primary" style={{ width: '100%' }} disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
