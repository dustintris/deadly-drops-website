'use client'

import { useEffect, useRef, useState } from 'react'
import { sendContactMessage } from '@/app/inbox-actions'
import { LIMITS, TOPICS, type Topic } from '@/lib/inbox/input'
import { EMAIL_ERROR, focusFirstError, isEmail } from '@/lib/forms'

const ORDER: [string, string][] = [['name', 'c-name'], ['email', 'c-email'], ['message', 'c-msg']]

/**
 * The Contact form. Messages go to Admin → Inbox. `about` (from /contact/?about=… on a product page) opens it
 * as a shop order about that item.
 */
export function ContactForm({ email, about }: { email: string; about?: string }) {
  const blank = () => ({
    name: '',
    email: '',
    topic: (about ? 'Shop order' : TOPICS[0]) as Topic,
    message: about ? `Hi! I’d like to buy: ${about}.\nSize: ` : '',
    // the hidden bot trap (see lib/inbox/input.ts): people never see it
    website: '',
  })
  const [f, setF] = useState(blank)
  const [err, setErr] = useState<Record<string, string>>({})
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setErr((e) => ({ ...e, [k]: '' })); setProblem('') }
  // the form (and its focused button) is replaced by the thanks: move focus there, so it's read out and keyboard
  // users carry on from it rather than from the top of the page
  const thanks = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (sent) thanks.current?.focus() }, [sent])

  if (sent) {
    return (
      <div role="status" className="card card-pad stack-16">
        <p className="eyebrow">Message sent</p>
        <h2 ref={thanks} tabIndex={-1} className="display d-s">Thanks, {sent.name.split(' ')[0]}</h2>
        <p className="muted">Your message is with the club. We’ll reply to {sent.email}, usually within a day.</p>
        <button className="btn btn-line btn-sm" onClick={() => { setSent(null); setF(blank()) }}>Write another</button>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const x: Record<string, string> = {}
    if (!f.name.trim()) x.name = 'Enter your name.'
    if (!isEmail(f.email)) x.email = `${EMAIL_ERROR} We reply to this address.`
    if (f.message.trim().length < 5) x.message = 'Tell us a little about what you need.'
    setErr(x)
    focusFirstError(x, ORDER)
    if (Object.keys(x).length) return
    setBusy(true)
    try {
      const r = await sendContactMessage(f)
      if (r.ok) { setSent({ name: f.name.trim(), email: f.email.trim() }); return }
      if (r.errors) { setErr(r.errors); focusFirstError(r.errors, ORDER) }
      // an error for a field with no message slot of its own (the topic) still needs saying
      const shown = r.errors && ORDER.some(([k]) => r.errors?.[k])
      setProblem(r.message ?? (r.errors ? (shown ? '' : Object.values(r.errors)[0] ?? '') : 'That didn’t go through. Try again in a moment.'))
    } catch {
      setProblem('That didn’t go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate className="stack-24" onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="field">
          <label htmlFor="c-name">Your name</label>
          <input id="c-name" required aria-required="true" className="input" placeholder="Full name" maxLength={LIMITS.name} value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!err.name} aria-describedby="c-name-e" autoComplete="name" />
          {err.name && <p id="c-name-e" className="error">{err.name}</p>}
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" required aria-required="true" type="email" inputMode="email" className="input" placeholder="you@email.com" maxLength={LIMITS.email} value={f.email} onChange={(e) => set('email', e.target.value)} onBlur={() => f.email && !isEmail(f.email) && setErr((x) => ({ ...x, email: `${EMAIL_ERROR} We reply to this address.` }))} aria-invalid={!!err.email} aria-describedby="c-email-e" autoComplete="email" />
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
        <textarea id="c-msg" required aria-required="true" className="input" maxLength={LIMITS.message} placeholder="Tell us what you need. If you've never played, say so and we'll pair you with someone patient." value={f.message} onChange={(e) => set('message', e.target.value)} aria-invalid={!!err.message} aria-describedby="c-msg-e" />
        {err.message && <p id="c-msg-e" className="error">{err.message}</p>}
      </div>
      {/* bot trap: off screen and inert (no focus, click or screen reader), and password managers are told to skip it */}
      <div inert aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="c-extra">Leave this empty</label>
        <input id="c-extra" name="ddp_extra" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore="" data-bwignore="" data-form-type="other"
          value={f.website} onChange={(e) => set('website', e.target.value)} />
      </div>
      {problem && <p role="alert" className="error">{problem} <a href={`mailto:${email}`} className="accent">{email}</a></p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-accent" type="submit" aria-disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
        <span className="small muted">Usually answered within a day.</span>
      </div>
    </form>
  )
}
