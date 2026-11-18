'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { deleteMessageAction, deleteSignupAction, setMessageHandledAction, type InboxResult } from '@/app/admin/inbox-actions'
import type { InboxMessage, Signup } from '@/lib/inbox/repo'

// the club is in Chula Vista: show its time, the same on the server and in the browser
const WHEN = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' })

/**
 * A reply link that can't be bent into extra headers or recipients (the form already refuses such addresses; this
 * is the second layer for anything stored before).
 */
function replyHref(m: InboxMessage) {
  const to = m.email.replace(/[%?&#,;]/g, (c) => encodeURIComponent(c))
  return `mailto:${to}?subject=${encodeURIComponent(`Re: ${m.topic} (Deadly Drops Pickleball)`)}`
}

/** A date in the club's time; browsers' date libraries can differ by a space from the server's, so no warning for it. */
const When = ({ iso, f = WHEN }: { iso: string; f?: Intl.DateTimeFormat }) => (
  <time dateTime={iso} suppressHydrationWarning>{f.format(new Date(iso))}</time>
)

export function InboxView({ messages, signups, signupTotal, canEdit }: { messages: InboxMessage[]; signups: Signup[]; signupTotal: number; canEdit: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [note, setNote] = useState<InboxResult | null>(null)
  const open = messages.filter((m) => !m.handledAt)
  const done = messages.filter((m) => m.handledAt)

  const run = (fn: () => Promise<InboxResult>) =>
    start(async () => {
      // cleared first, so the same message twice in a row is announced twice
      setNote(null)
      try {
        setNote(await fn())
      } catch {
        setNote({ ok: false, message: 'That didn’t go through. Check your connection and try again.' })
      }
      router.refresh()
    })

  const removeMessage = (m: InboxMessage) => {
    if (!window.confirm(`Delete the message from ${m.name}?\n\nThis can’t be undone.`)) return
    run(() => deleteMessageAction(m.id))
  }
  const removeSignup = (s: Signup) => {
    if (!window.confirm(`Take ${s.email} off the email list?`)) return
    run(() => deleteSignupAction(s.id))
  }

  const card = (m: InboxMessage) => (
    <li key={m.id} className="adm-item" data-open="true">
      <header>
        <span className="title">
          {m.name}
          <span className="adm-badge">{m.topic}</span>
          {m.handledAt && <span className="adm-badge on">Dealt with</span>}
        </span>
        <span className="adm-muted"><When iso={m.createdAt} /></span>
      </header>
      <div className="body">
        <p><a href={replyHref(m)}>{m.email}</a></p>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.message}</p>
        {m.handledAt && (
          <p className="adm-muted">Dealt with{m.handledBy ? ` by ${m.handledBy}` : ''} on <When iso={m.handledAt} /></p>
        )}
        <div className="adm-actions">
          <a className="adm-btn small primary" href={replyHref(m)}>Reply by email</a>
          {canEdit && (
            <>
              <button type="button" className="adm-btn small" aria-disabled={pending} onClick={() => !pending && run(() => setMessageHandledAction(m.id, !m.handledAt))}>
                {m.handledAt ? 'Move back to open' : 'Mark as dealt with'}
              </button>
              <button type="button" className="adm-btn small danger" aria-disabled={pending} onClick={() => !pending && removeMessage(m)}>Delete</button>
            </>
          )}
        </div>
      </div>
    </li>
  )

  return (
    <div className="adm-grid" style={{ gap: 32 }}>
      {/* always in the page (empty until there's news), so screen readers announce each change */}
      <p role="status" className={note ? `adm-note ${note.ok ? 'good' : 'bad'}` : undefined} hidden={!note}>{note?.message ?? ''}</p>

      <section aria-labelledby="inbox-open">
        <h2 id="inbox-open">Messages <span className="adm-count">{open.length} open</span></h2>
        {open.length === 0 ? (
          <p className="adm-muted">{messages.length ? 'Everything has been dealt with.' : 'No messages yet. They appear here when someone uses the Contact page.'}</p>
        ) : (
          <ul className="adm-list">{open.map(card)}</ul>
        )}
        {done.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary className="adm-muted">Dealt with ({done.length})</summary>
            <ul className="adm-list" style={{ marginTop: 12 }}>{done.map(card)}</ul>
          </details>
        )}
      </section>

      <section aria-labelledby="inbox-list">
        <h2 id="inbox-list">Email list <span className="adm-count">{signupTotal}</span></h2>
        <p className="adm-muted">
          People who asked for event news in the site footer. Download the list for your email tool or a spreadsheet.
          The site doesn’t confirm these addresses, so when you import them, use your email tool’s confirmation
          (double opt-in) email before sending news.
        </p>
        <div className="adm-actions" style={{ margin: '12px 0' }}>
          <a className="adm-btn small primary" href="/admin/api/signups/" download>Download the list (CSV)</a>
        </div>
        {signups.length === 0 ? (
          <p className="adm-muted">Nobody yet.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr><th scope="col">Email</th><th scope="col">Joined</th>{canEdit && <th scope="col"><span className="sr">Remove</span></th>}</tr>
            </thead>
            <tbody>
              {signups.map((s) => (
                <tr key={s.id}>
                  <td style={{ overflowWrap: 'anywhere' }}>{s.email}</td>
                  <td><When iso={s.createdAt} f={DAY} /></td>
                  {canEdit && (
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="adm-btn small" aria-disabled={pending} onClick={() => !pending && removeSignup(s)}>
                        Remove<span className="sr"> {s.email}</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {signupTotal > signups.length && <p className="adm-muted">Showing the newest {signups.length}. The download has all {signupTotal}.</p>}
      </section>
    </div>
  )
}
