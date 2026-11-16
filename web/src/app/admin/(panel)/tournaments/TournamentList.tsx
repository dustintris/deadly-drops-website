'use client'

/**
 * Tournaments list: every tournament with its date and status, a link to its editor, Delete, and
 * "New tournament" (created hidden, then the editor opens). The server checks every action.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { createTournamentAction, deleteTournamentAction, type TournamentResult } from '@/app/admin/tournament-actions'

export type TournamentRow = { id: number; name: string; dateLabel: string; visible: boolean; featured: boolean; divisionCount: number }
type Note = { ok: boolean; text: string }

/** Runs a Server Action; a dropped connection becomes a message instead of an unhandled error. */
async function call(fn: () => Promise<TournamentResult>): Promise<TournamentResult> {
  try {
    return await fn()
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection, or sign in again, then try again.' }
  }
}

const noteClass = (note: Note | null) => `adm-note ${note ? (note.ok ? 'good' : 'bad') : ''}`

export function TournamentList({ tournaments, canEdit }: { tournaments: TournamentRow[]; canEdit: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [note, setNote] = useState<Note | null>(null)
  const onDeleted = (n: Note) => {
    setNote(n)
    if (n.ok) headingRef.current?.focus() // the deleted row's buttons are gone: land back on the list
  }

  return (
    <>
      <section aria-labelledby="tournament-list-h" style={{ display: 'grid', gap: 12 }}>
        <h2 id="tournament-list-h" ref={headingRef} tabIndex={-1}>All tournaments ({tournaments.length})</h2>
        <p role="status" className={noteClass(note)}>{note?.text}</p>
        {tournaments.length === 0 ? (
          <p className="adm-muted">No tournaments yet.{canEdit ? ' Create the first one below.' : ''}</p>
        ) : (
          <ul className="adm-list">
            {tournaments.map((t) => <TournamentCard key={t.id} t={t} canEdit={canEdit} onDeleted={onDeleted} />)}
          </ul>
        )}
      </section>
      {canEdit && <NewTournament />}
    </>
  )
}

function TournamentCard({ t, canEdit, onDeleted }: { t: TournamentRow; canEdit: boolean; onDeleted: (n: Note) => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (busy) return
    const divisions = t.divisionCount ? ` and its ${t.divisionCount === 1 ? 'division' : `${t.divisionCount} divisions`}` : ''
    if (!window.confirm(`Delete “${t.name}”${divisions}?\n\nThis can’t be undone. To take it off the website for now, untick “Show on the website” in the tournament instead.`)) return
    setBusy(true)
    const res = await call(() => deleteTournamentAction(t.id))
    setBusy(false)
    onDeleted({ ok: res.ok, text: res.ok ? `${t.name} deleted.` : res.message })
    if (res.ok) router.refresh()
  }

  return (
    <li className="adm-item">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px 16px', flexWrap: 'wrap', padding: '14px 16px' }}>
        <div style={{ display: 'grid', gap: 4, flex: '1 1 260px', minWidth: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 16, overflowWrap: 'anywhere' }}>
            {t.name}
            <span className={`adm-badge ${t.visible ? 'on' : 'off'}`}>{t.visible ? 'Visible' : 'Hidden'}</span>
            {t.featured && <span className="adm-badge on">Featured</span>}
          </h3>
          <p className="adm-muted">
            {t.dateLabel} · {t.divisionCount === 0 ? 'No divisions yet' : t.divisionCount === 1 ? '1 division' : `${t.divisionCount} divisions`}
          </p>
        </div>
        <div className="adm-actions">
          <Link className="adm-btn small" href={`/admin/tournaments/${t.id}/`}>
            {canEdit ? 'Edit' : 'View'}<span className="sr"> {t.name}</span>
          </Link>
          {canEdit && (
            <button type="button" className="adm-btn small danger" aria-disabled={busy} onClick={remove}>
              {busy ? 'Deleting…' : 'Delete'}<span className="sr"> {t.name}</span>
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

function NewTournament() {
  const router = useRouter()
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    if (name.trim().length < 3) {
      setError('Enter a name of at least 3 characters.')
      setNote({ ok: false, text: 'Fix the highlighted field.' })
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setNote(null)
    const res = await call(() => createTournamentAction(name))
    if (!res.ok || !res.tournament) {
      setBusy(false)
      setError(res.errors?.name)
      setNote({ ok: false, text: res.message })
      inputRef.current?.focus()
      return
    }
    setNote({ ok: true, text: `${res.message} Opening it…` })
    router.push(`/admin/tournaments/${res.tournament.id}/`)
  }

  const describedBy = [error && `${id}-err`, `${id}-hint`].filter(Boolean).join(' ')
  return (
    <section className="adm-card" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>New tournament</h2>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
        <div className="adm-field">
          <label htmlFor={id}>Tournament name</label>
          <input ref={inputRef} id={id} className="adm-input" value={name} maxLength={80} autoComplete="off" required
            aria-invalid={!!error} aria-describedby={describedBy}
            onChange={(e) => { setName(e.target.value); setError(undefined) }} />
          {error && <p className="err" id={`${id}-err`}>{error}</p>}
          <p className="hint" id={`${id}-hint`}>It starts hidden from the website, so you can fill in the details first.</p>
        </div>
        <div className="adm-actions">
          <button type="submit" className="adm-btn primary" aria-disabled={busy}>{busy ? 'Creating…' : 'Create tournament'}</button>
          <p role="status" className={noteClass(note)}>{note?.text}</p>
        </div>
      </form>
    </section>
  )
}
