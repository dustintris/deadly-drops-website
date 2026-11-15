'use client'

import { useState } from 'react'
import { EMAIL_ERROR, isEmail } from '@/lib/forms'
import styles from './shell.module.css'

/** Preview only: validates and confirms locally. Wire to the mailing-list provider in production. */
export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'error' | 'done'>('idle')

  if (state === 'done') return <p className={styles.joinNote}>You're on the list. We'll email {email} before the next event.</p>

  return (
    <form
      className={styles.join}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (isEmail(email)) setState('done')
        else { setState('error'); document.getElementById('join-email')?.focus() }
      }}
    >
      <label htmlFor="join-email" className={styles.joinLabel}>Your email</label>
      <input
        id="join-email"
        className="input"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@email.com"
        value={email}
        aria-invalid={state === 'error'}
        aria-describedby="join-help"
        onChange={(e) => { setEmail(e.target.value); setState('idle') }}
      />
      <button className="btn btn-accent btn-sm" type="submit">Send</button>
      <p id="join-help" role="status" className={state === 'error' ? 'error' : styles.joinNote}>
        {state === 'error' ? EMAIL_ERROR : 'Event news and registration dates, a few times a year.'}
      </p>
    </form>
  )
}
