'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  cancelActivationCodeAction,
  createActivationCodeAction,
  revokeInstallAction,
  type ActivationResult,
} from '@/app/admin/desktop-app-actions'

export type CodeRow = { id: number; label: string; createdBy: string; expiresAt: string }
export type InstallRow = {
  id: number
  label: string
  deviceName: string
  lastVersion: string | null
  activatedAt: string
  lastSeenAt: string | null
  revokedAt: string | null
}
/** A code made on this page since it was opened, with the open-codes list as it was when it was made. */
type MadeCode = { id: number; code: string; label: string; expiresAt: string; before: CodeRow[] }

// the club is in Chula Vista: its time, the same on the server and in the browser
const WHEN = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const when = (iso: string) => WHEN.format(new Date(iso))
const When = ({ iso }: { iso: string | null }) =>
  iso ? <time dateTime={iso} suppressHydrationWarning>{when(iso)}</time> : <span className="adm-muted">Not yet</span>
const FAILED: ActivationResult = { ok: false, message: 'That didn’t go through. Check your connection and try again.' }

/**
 * Activation codes (made here, shown once) and the computers they activated, with Revoke. The actions revalidate the
 * page themselves, so the lists update without a refresh here.
 */
export function ActivationPanel({ ready, codes, active, revoked, revokedTotal }: {
  ready: boolean
  codes: CodeRow[]
  active: InstallRow[]
  revoked: InstallRow[]
  revokedTotal: number
}) {
  const [creating, startCreate] = useTransition()
  const [pending, start] = useTransition()
  const busy = creating || pending
  const [label, setLabel] = useState('')
  const [made, setMade] = useState<MadeCode[]>([])
  const [focusId, setFocusId] = useState<number | null>(null)
  const [note, setNote] = useState<ActivationResult | null>(null)
  const codesHeading = useRef<HTMLHeadingElement>(null)
  const installsHeading = useRef<HTMLHeadingElement>(null)
  const inputs = useRef(new Map<number, HTMLInputElement>())
  const openIds = new Set(codes.map((c) => c.id))

  // a new code is focused and selected, ready to copy or read out
  useEffect(() => {
    if (focusId === null) return
    const el = inputs.current.get(focusId)
    el?.focus()
    el?.select()
  }, [focusId])

  /**
   * A made code no longer works once the open-codes list has been refreshed since it was made (the page is revalidated
   * after every change, so a newer list includes it while it is open) and doesn't include it any more.
   */
  const gone = (m: MadeCode) => codes !== m.before && !openIds.has(m.id)

  const act = (startFn: typeof start, fn: () => Promise<ActivationResult>, after?: (r: ActivationResult) => void) =>
    startFn(async () => {
      // cleared first, so the same message twice in a row is announced twice
      setNote(null)
      let r = FAILED
      try {
        r = await fn()
      } catch {
        // r stays FAILED
      }
      setNote(r)
      after?.(r)
    })

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !ready) return
    const before = codes
    act(startCreate, () => createActivationCodeAction(label), (r) => {
      if (!r.ok || !r.id || !r.code || !r.label || !r.expiresAt) return
      const fresh: MadeCode = { id: r.id, code: r.code, label: r.label, expiresAt: r.expiresAt, before }
      setMade((list) => [fresh, ...list])
      setFocusId(r.id)
      setLabel('')
    })
  }
  const cancel = (c: CodeRow) => {
    if (busy || !window.confirm(`Cancel the code for ${c.label} (expires ${when(c.expiresAt)})?\n\nIt stops working at once.`)) return
    act(start, () => cancelActivationCodeAction(c.id), () => codesHeading.current?.focus())
  }
  const revoke = (i: InstallRow) => {
    if (busy) return
    const which = `${i.label}${i.deviceName ? ` on ${i.deviceName}` : ''}, activated ${when(i.activatedAt)}`
    if (!window.confirm(`Revoke ${which}?\n\nThe app on that computer stops downloading tournaments and updates. It needs a new code to work again.`)) return
    act(start, () => revokeInstallAction(i.id), () => installsHeading.current?.focus())
  }
  const copy = async (m: MadeCode) => {
    try {
      await navigator.clipboard.writeText(m.code)
      setNote({ ok: true, message: `Copied the code for ${m.label}.` })
    } catch {
      setNote({ ok: false, message: 'Couldn’t copy the code: select it and copy it yourself.' })
    }
  }

  return (
    <>
      <section className="adm-card" aria-labelledby="activate-h">
        <h2 id="activate-h">Activate a computer</h2>
        <p className="adm-muted">The app only works on computers you activate here. One code activates one computer.</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
          <li>Download the app above and install it on the computer.</li>
          <li>Open the app. It asks for an activation code.</li>
          <li>Make a code here and type it into the app. Each code works once, within 7 days.</li>
        </ol>
        {!ready ? (
          <p className="adm-note bad">Activation isn’t set up on the server yet (DESKTOP_CODE_SECRET).</p>
        ) : (
          <form onSubmit={create} className="adm-field" style={{ maxWidth: 520 }}>
            <label htmlFor="code-label">Name of the computer</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input id="code-label" className="adm-input" style={{ flex: '1 1 220px' }} maxLength={60} placeholder="Venue laptop"
                value={label} onChange={(e) => setLabel(e.target.value)} aria-describedby="code-label-hint" />
              <button type="submit" className="adm-btn primary" aria-disabled={busy} aria-busy={creating}>
                {creating ? 'Creating…' : 'Create activation code'}
              </button>
            </div>
            <p className="hint" id="code-label-hint">So you can tell the computers apart in the list below.</p>
          </form>
        )}

        {made.length > 0 && (
          <div style={{ display: 'grid', gap: 12 }}>
            {made.map((m) => (
              <div key={m.id} className="adm-field" style={{ padding: 16, borderRadius: 10, border: '1px solid rgb(var(--ink-dark-rgb) / .15)' }}>
                {gone(m) ? (
                  <p className="adm-muted" style={{ margin: 0 }}>
                    <span className="adm-badge off">No longer works</span> The code for {m.label} was used, cancelled or ran out.
                  </p>
                ) : (
                  <>
                    <label htmlFor={`made-code-${m.id}`}>Activation code for {m.label} (shown once)</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        id={`made-code-${m.id}`}
                        ref={(el) => {
                          if (el) inputs.current.set(m.id, el)
                          else inputs.current.delete(m.id)
                        }}
                        className="adm-input adm-mono adm-secret"
                        style={{ flex: '1 1 280px' }}
                        readOnly
                        value={m.code}
                        aria-label={`Activation code for ${m.label}: ${m.code}`}
                        onFocus={(e) => e.target.select()}
                      />
                      <button type="button" className="adm-btn" onClick={() => void copy(m)}>
                        Copy<span className="sr"> the code for {m.label}</span>
                      </button>
                    </div>
                    <p className="hint">
                      Type it into the app on that computer. It works once and expires <When iso={m.expiresAt} />. It
                      can’t be shown again: if it’s lost, cancel it and make a new one.
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <p role="status" className={note ? `adm-note ${note.ok ? 'good' : 'bad'}` : undefined}>{note?.message ?? ''}</p>

        <h3 id="codes-h" ref={codesHeading} tabIndex={-1}>Codes not used yet ({codes.length})</h3>
        {codes.length === 0 ? (
          <p className="adm-muted">None. Codes that were used, cancelled or ran out don’t show here.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table" aria-labelledby="codes-h">
              <thead>
                <tr><th scope="col">For</th><th scope="col">Made by</th><th scope="col">Expires</th><th scope="col"><span className="sr">Cancel</span></th></tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.label}</td>
                    <td style={{ overflowWrap: 'anywhere' }}>{c.createdBy}</td>
                    <td><When iso={c.expiresAt} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="adm-btn small" aria-disabled={busy} onClick={() => cancel(c)}>
                        Cancel<span className="sr"> the code for {c.label}, expires <When iso={c.expiresAt} /></span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="adm-card" aria-labelledby="installs-h">
        <h2 id="installs-h" ref={installsHeading} tabIndex={-1}>Activated computers ({active.length})</h2>
        {active.length === 0 ? (
          <p className="adm-muted">None yet. Computers show here once they’re activated with a code.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table" style={{ minWidth: 640 }} aria-labelledby="installs-h">
              <thead>
                <tr>
                  <th scope="col">Computer</th><th scope="col">Device name</th><th scope="col">Version</th>
                  <th scope="col">Activated</th><th scope="col">Last seen</th><th scope="col"><span className="sr">Revoke</span></th>
                </tr>
              </thead>
              <tbody>
                {active.map((i) => (
                  <tr key={i.id}>
                    <td>{i.label}</td>
                    <td style={{ overflowWrap: 'anywhere' }}>{i.deviceName || <span className="adm-muted">Unknown</span>}</td>
                    <td className="adm-mono">{i.lastVersion ?? '–'}</td>
                    <td><When iso={i.activatedAt} /></td>
                    <td><When iso={i.lastSeenAt} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="adm-btn small danger" aria-disabled={busy} onClick={() => revoke(i)}>
                        Revoke
                        <span className="sr">
                          {' '}{i.label}{i.deviceName ? `, ${i.deviceName}` : ''}, activated <When iso={i.activatedAt} />
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {revokedTotal > 0 && (
          <details>
            <summary className="adm-muted">Revoked ({revokedTotal})</summary>
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="adm-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr><th scope="col">Computer</th><th scope="col">Device name</th><th scope="col">Version</th><th scope="col">Activated</th><th scope="col">Revoked</th></tr>
                </thead>
                <tbody>
                  {revoked.map((i) => (
                    <tr key={i.id}>
                      <td>{i.label}</td>
                      <td style={{ overflowWrap: 'anywhere' }}>{i.deviceName || '–'}</td>
                      <td className="adm-mono">{i.lastVersion ?? '–'}</td>
                      <td><When iso={i.activatedAt} /></td>
                      <td><When iso={i.revokedAt} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {revokedTotal > revoked.length && <p className="adm-muted">Showing the newest {revoked.length} of {revokedTotal}.</p>}
          </details>
        )}
      </section>
    </>
  )
}
