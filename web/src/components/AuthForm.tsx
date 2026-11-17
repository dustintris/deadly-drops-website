'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { EMAIL_ERROR, focusFirstError, isEmail } from '@/lib/forms'
import styles from './auth.module.css'

const LEVELS = ['New', '2.5', '3.0', '3.5', '4.0+']

/**
 * Log in / create account with a working tab switcher.
 * Preview: any valid input "signs in" and opens the member area.
 * Production: replace onSubmit with the auth provider (e.g. Auth.js, Clerk, Supabase).
 */
export function AuthForm({ initial }: { initial: 'login' | 'signup' }) {
  const [mode, setMode] = useState(initial)
  const [show, setShow] = useState(false)
  const [level, setLevel] = useState('New')
  const [f, setF] = useState({ name: '', email: '', password: '', keep: true })
  const [err, setErr] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const router = useRouter()
  const signup = mode === 'signup'
  const set = (k: keyof typeof f, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, [k]: '' })) }

  return (
    <div className={styles.formSide}>
      <div className={styles.tabs} role="tablist" aria-label="Account">
        <button role="tab" aria-selected={!signup} onClick={() => { setMode('login'); setErr({}) }}>Log in</button>
        <button role="tab" aria-selected={signup} onClick={() => { setMode('signup'); setErr({}) }}>Create account</button>
      </div>

      <h1 className="display d-m">{signup ? 'Join the club' : 'Welcome back'}</h1>
      <p className="muted">
        {signup
          ? 'Two minutes. No rating required and no tryout. To enter a tournament, register on Main Court.'
          : 'Sign in to check the ladder, your profile and your member discount.'}
      </p>

      <form
        noValidate
        className="stack-16"
        onSubmit={(e) => {
          e.preventDefault()
          const x: Record<string, string> = {}
          if (signup && !f.name.trim()) x.name = 'Enter your full name.'
          if (!isEmail(f.email)) x.email = EMAIL_ERROR
          if (f.password.length < (signup ? 8 : 1)) x.password = signup ? 'Use at least 8 characters.' : 'Enter your password.'
          setErr(x)
          focusFirstError(x, [['name', 'a-name'], ['email', 'a-email'], ['password', 'a-pass']])
          if (!Object.keys(x).length) router.push('/me/')
        }}
      >
        {signup && (
          <div className="field">
            <label htmlFor="a-name">Full name</label>
            <input id="a-name" required aria-required="true" className="input" value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!err.name} aria-describedby="a-name-e" autoComplete="name" />
            {err.name && <p id="a-name-e" className="error">{err.name}</p>}
          </div>
        )}
        <div className="field">
          <label htmlFor="a-email">Email</label>
          <input id="a-email" required aria-required="true" type="email" inputMode="email" className="input" placeholder="you@email.com" value={f.email} onChange={(e) => set('email', e.target.value)} onBlur={() => f.email && !isEmail(f.email) && setErr((x) => ({ ...x, email: EMAIL_ERROR }))} aria-invalid={!!err.email} aria-describedby="a-email-e" autoComplete="email" />
          {err.email && <p id="a-email-e" className="error">{err.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="a-pass">Password</label>
          <div className={styles.pass}>
            <input id="a-pass" required aria-required="true" type={show ? 'text' : 'password'} className="input" value={f.password} onChange={(e) => set('password', e.target.value)} aria-invalid={!!err.password} aria-describedby="a-pass-e" autoComplete={signup ? 'new-password' : 'current-password'} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </div>
          {err.password && <p id="a-pass-e" className="error">{err.password}</p>}
        </div>
        {signup ? (
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend className="label" style={{ marginBottom: 10 }}>Your level (a guess is fine)</legend>
            <div className="chips">
              {LEVELS.map((l) => <button type="button" key={l} className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>{l}</button>)}
            </div>
          </fieldset>
        ) : (
          <div className={styles.row}>
            <label className={styles.keep}>
              <input type="checkbox" checked={f.keep} onChange={(e) => set('keep', e.target.checked)} /> Keep me signed in
            </label>
            <button type="button" className={styles.forgot} onClick={() => setNote('Password reset emails start working once sign-in is connected.')}>Forgot password?</button>
          </div>
        )}
        <button className="btn btn-accent btn-block" type="submit">{signup ? 'Create my account' : 'Log in'}</button>
      </form>

      <div className={styles.or}><span>or</span></div>
      <button className="btn btn-ghost btn-block" onClick={() => setNote('Google sign-in connects when the club’s accounts system goes live.')}>Continue with Google</button>
      {note && <p className="small muted" role="status">{note}</p>}
      <p className={`small muted ${styles.switch}`}>
        {signup ? 'Already a member? Use Log in above.' : 'New here? Create an account to join the club ladder.'}
      </p>
    </div>
  )
}
