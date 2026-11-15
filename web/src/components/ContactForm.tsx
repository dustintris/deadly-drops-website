'use client'

import { useState } from 'react'
import { EMAIL_ERROR, focusFirstError, isEmail } from '@/lib/forms'

const TOPICS = ['Joining', 'Tournaments', 'Coaching', 'Shop order', 'Something else']

/** Preview contact form: validates and confirms locally. Production: POST to the enquiries API / email service. */
export function ContactForm({ email }: { email: string }) {
  const [f, setF] = useState({ name: '', email: '', topic: TOPICS[0], message: '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, [k]: '' })) }

  if (sent) {
    return (
      <div role="status" className="card card-pad stack-16">
        <p className="eyebrow">Message ready · preview</p>
        <h2 className="display d-s">Thanks, {f.name.split(' ')[0]}</h2>
        <p className="muted">
          The live site sends this to the club and replies within a day. In this preview nothing was sent. Email{' '}
          <a href={`mailto:${email}`} className="accent">{email}</a> directly in the meantime.
        </p>
        <button className="btn btn-line btn-sm" onClick={() => { setSent(false); setF({ name: '', email: '', topic: TOPICS[0], message: '' }) }}>Write another</button>
      </div>
    )
  }

  return (
    <form
      noValidate
      className="stack-24"
      onSubmit={(e) => {
        e.preventDefault()
        const x: Record<string, string> = {}
        if (!f.name.trim()) x.name = 'Enter your name.'
        if (!isEmail(f.email)) x.email = `${EMAIL_ERROR} We reply to this address.`
        if (f.message.trim().length < 5) x.message = 'Tell us a little about what you need.'
        setErr(x)
        focusFirstError(x, [['name', 'c-name'], ['email', 'c-email'], ['message', 'c-msg']])
        if (!Object.keys(x).length) setSent(true)
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="field">
          <label htmlFor="c-name">Your name</label>
          <input id="c-name" className="input" placeholder="Full name" value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!err.name} aria-describedby="c-name-e" autoComplete="name" />
          {err.name && <p id="c-name-e" className="error">{err.name}</p>}
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" type="email" inputMode="email" className="input" placeholder="you@email.com" value={f.email} onChange={(e) => set('email', e.target.value)} onBlur={() => f.email && !isEmail(f.email) && setErr((x) => ({ ...x, email: `${EMAIL_ERROR} We reply to this address.` }))} aria-invalid={!!err.email} aria-describedby="c-email-e" autoComplete="email" />
          {err.email && <p id="c-email-e" className="error">{err.email}</p>}
        </div>
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend className="label" style={{ marginBottom: 10 }}>What's this about</legend>
        <div className="chips">
          {TOPICS.map((t) => (
            <button type="button" key={t} className="chip" aria-pressed={f.topic === t} onClick={() => set('topic', t)}>{t}</button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="c-msg">Message</label>
        <textarea id="c-msg" className="input" placeholder="Tell us what you need. If you've never played, say so and we'll pair you with someone patient." value={f.message} onChange={(e) => set('message', e.target.value)} aria-invalid={!!err.message} aria-describedby="c-msg-e" />
        {err.message && <p id="c-msg-e" className="error">{err.message}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-accent" type="submit">Send message</button>
        <span className="small muted">Usually answered within a day.</span>
      </div>
    </form>
  )
}
