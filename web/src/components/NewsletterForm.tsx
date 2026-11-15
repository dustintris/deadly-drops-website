'use client'

import { useState } from 'react'
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
        setState(/^\S+@\S+\.\S+$/.test(email) ? 'done' : 'error')
      }}
    >
      <label htmlFor="join-email" className="sr">Email</label>
      <input
        id="join-email"
        className="input"
        type="email"
        placeholder="Email"
        value={email}
        aria-invalid={state === 'error'}
        aria-describedby="join-help"
        onChange={(e) => { setEmail(e.target.value); setState('idle') }}
      />
      <button className="btn btn-accent btn-sm" type="submit">Send</button>
      <p id="join-help" className={state === 'error' ? 'error' : styles.joinNote}>
        {state === 'error' ? 'Enter an email like name@example.com.' : 'Event news and registration dates, a few times a year.'}
      </p>
    </form>
  )
}
