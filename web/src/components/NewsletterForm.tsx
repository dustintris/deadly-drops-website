'use client'

import { useEffect, useRef, useState } from 'react'
import { joinMailingList } from '@/app/inbox-actions'
import { LIMITS } from '@/lib/inbox/input'
import { EMAIL_ERROR, isEmail } from '@/lib/forms'
import styles from './shell.module.css'

/** "Join the list" in the footer: the address goes on the email list in Admin → Inbox. */
export function NewsletterForm() {
  const [email, setEmail] = useState('')
  // the hidden bot trap (see lib/inbox/input.ts)
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'error' | 'done'>('idle')
  const [problem, setProblem] = useState('')
  // only a bad address marks the field invalid; a busy server or a lost connection isn't the address's fault
  const [invalid, setInvalid] = useState(false)
  // the form (and its focused button) is replaced by the note: move focus there so it's read out
  const doneNote = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (state === 'done') doneNote.current?.focus() }, [state])

  if (state === 'done') {
    return <p ref={doneNote} tabIndex={-1} role="status" className={styles.joinNote}>You're on the list. We'll email {email.trim()} before the next event.</p>
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'busy') return
    if (!isEmail(email)) {
      setProblem(EMAIL_ERROR)
      setInvalid(true)
      setState('error')
      document.getElementById('join-email')?.focus()
      return
    }
    setState('busy')
    try {
      const r = await joinMailingList({ email, website })
      if (r.ok) { setState('done'); return }
      setInvalid(!!r.errors?.email)
      setProblem(r.errors?.email ?? r.message ?? 'That didn’t go through. Try again in a moment.')
    } catch {
      setInvalid(false)
      setProblem('That didn’t go through. Check your connection and try again.')
    }
    setState('error')
  }

  return (
    <form className={styles.join} noValidate onSubmit={submit}>
      <label htmlFor="join-email" className={styles.joinLabel}>Your email</label>
      <input
        id="join-email"
        required
        aria-required="true"
        className="input"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@email.com"
        maxLength={LIMITS.email}
        value={email}
        aria-invalid={invalid}
        aria-describedby="join-help"
        onChange={(e) => { setEmail(e.target.value); setInvalid(false); if (state === 'error') setState('idle') }}
      />
      {/* bot trap: off screen and inert (no focus, click or screen reader), and password managers are told to skip it */}
      <span inert aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="join-extra">Leave this empty</label>
        <input id="join-extra" name="ddp_extra" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore="" data-bwignore="" data-form-type="other"
          value={website} onChange={(e) => setWebsite(e.target.value)} />
      </span>
      <button className="btn btn-accent btn-sm" type="submit" aria-disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Send'}</button>
      <p id="join-help" role="status" className={state === 'error' ? 'error' : styles.joinNote}>
        {state === 'error' ? problem : 'Event news and registration dates, a few times a year.'}
      </p>
    </form>
  )
}
