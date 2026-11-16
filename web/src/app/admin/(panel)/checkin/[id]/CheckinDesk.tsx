'use client'

/**
 * The check-in desk: search a name, tap it as the player arrives (tap again to undo), or check a
 * whole team in at once. A tap shows at once; the server's answer and <LiveRefresh> (other desks,
 * the venue screen) keep it true.
 */
import { useId, useState } from 'react'
import { setCheckedInAction } from '@/app/admin/play-actions'
import { filterRoster, rosterCounts, teamComplete, type RosterDivision, type RosterPlayer, type RosterTeam } from '@/lib/play/checkin'

type Props = { tournamentId: number; days: string[]; todayIndex: number; divisions: RosterDivision[]; canEdit: boolean }

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })

export function CheckinDesk({ tournamentId, days, todayIndex, divisions, canEdit }: Props) {
  const searchId = useId()
  const [q, setQ] = useState('')
  const [divisionId, setDivisionId] = useState<number | null>(null)
  const [onlyMissing, setOnlyMissing] = useState(false)
  /** answers from this desk's own taps, until the next server render brings them anyway */
  const [mine, setMine] = useState<Record<number, string | null>>({})
  const [pending, setPending] = useState<Record<number, boolean>>({})
  const [announce, setAnnounce] = useState('')
  const [error, setError] = useState('')

  // a fresh server render (any desk's change) replaces this desk's own answers
  const [seen, setSeen] = useState(divisions)
  if (seen !== divisions) {
    setSeen(divisions)
    setMine({})
  }

  const say = (msg: string) => setAnnounce((prev) => (prev === msg ? `${msg} ` : msg))
  const withMine = (p: RosterPlayer): RosterPlayer => (p.id in mine ? { ...p, checkedInAt: mine[p.id] } : p)
  const current = divisions.map((d) => ({ ...d, teams: d.teams.map((t) => ({ ...t, players: t.players.map(withMine) })) }))
  const shown = filterRoster(current, { q, divisionId, onlyMissing })
  const counts = rosterCounts(current)
  const multiDay = days.length > 1

  const toggle = async (ps: RosterPlayer[], checkedIn: boolean, label: string) => {
    if (!canEdit || !ps.length || ps.some((p) => pending[p.id])) return
    const ids = ps.map((p) => p.id)
    const mark = (on: boolean) => setPending((prev) => {
      const next = { ...prev }
      for (const id of ids) on ? (next[id] = true) : delete next[id]
      return next
    })
    mark(true)
    setError('')
    try {
      const res = await setCheckedInAction({ tournamentId, playerIds: ids, checkedIn })
      if (!res.ok) {
        setError(res.message)
        return
      }
      setMine((prev) => {
        const next = { ...prev }
        for (const p of res.players ?? []) next[p.id] = p.checkedInAt
        return next
      })
      say(checkedIn ? `${label} checked in.` : `${label}: check-in undone.`)
    } catch {
      setError('Couldn’t reach the server. Check the connection and tap again.')
    } finally {
      mark(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section aria-label="Find players" className="adm-card" style={{ display: 'grid', gap: 12, padding: 14 }}>
        <p style={{ fontSize: 18, fontWeight: 700 }}>
          {counts.checkedIn} of {counts.players} players here · {counts.teamsComplete} of {counts.teams} teams complete
        </p>
        <div className="adm-field">
          <label htmlFor={searchId}>Search a player or team</label>
          <input id={searchId} className="adm-input" type="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Start typing a name" style={{ minHeight: 52, fontSize: 18 }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
          <div className="adm-field" style={{ flex: '1 1 220px' }}>
            <label htmlFor={`${searchId}-div`}>Division</label>
            <select id={`${searchId}-div`} className="adm-input" style={{ minHeight: 48 }} value={divisionId ?? ''}
              onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All divisions</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{multiDay && days[d.dayIndex] ? ` (${days[d.dayIndex]}${d.dayIndex === todayIndex ? ', today' : ''})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={`adm-btn ${onlyMissing ? 'primary' : ''}`} style={{ minHeight: 48 }} aria-pressed={onlyMissing}
            onClick={() => setOnlyMissing((v) => !v)}>
            Only teams still missing someone
          </button>
        </div>
      </section>

      <p role="status" className="adm-note good" style={{ minHeight: 0 }}>{announce}</p>
      {error && <p role="alert" className="adm-note bad">{error}</p>}

      {counts.players === 0 ? (
        <p className="adm-muted">No players yet. Add teams under Tournaments → Teams &amp; schedule.</p>
      ) : shown.length === 0 ? (
        <p className="adm-muted">Nobody matches. Check the spelling, or clear the filters.</p>
      ) : (
        shown.map((d) => (
          <section key={d.id} aria-labelledby={`ci-d-${d.id}`} style={{ display: 'grid', gap: 10 }}>
            <h2 id={`ci-d-${d.id}`} style={{ fontSize: 20 }}>
              {d.name}{multiDay && days[d.dayIndex] ? <span className="adm-muted" style={{ fontWeight: 400 }}> · {days[d.dayIndex]}</span> : null}
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
              {d.teams.map((t) => <TeamCard key={t.id} t={t} canEdit={canEdit} pending={pending} onToggle={toggle} />)}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function TeamCard({ t, canEdit, pending, onToggle }: {
  t: RosterTeam
  canEdit: boolean
  pending: Record<number, boolean>
  onToggle: (ps: RosterPlayer[], checkedIn: boolean, label: string) => void
}) {
  const complete = teamComplete(t)
  const missing = t.players.filter((p) => !p.checkedInAt)
  const busy = t.players.some((p) => pending[p.id])
  return (
    <li className="adm-card" style={{ display: 'grid', gap: 10, padding: 14, borderLeft: complete ? '5px solid var(--accent)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ flex: 1, minWidth: 0, fontSize: 17, overflowWrap: 'anywhere' }}>{t.name}</strong>
        <span className={`adm-badge ${complete ? 'on' : 'off'}`}>{complete ? 'All here' : `${t.players.length - missing.length}/${t.players.length} here`}</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {t.players.map((p) => {
          const here = p.checkedInAt !== null
          const text = (
            <>
              <span aria-hidden="true" style={{ fontSize: 22, width: '1.2em' }}>{here ? '✓' : '○'}</span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflowWrap: 'anywhere' }}>{p.name}</span>
              <span className="adm-muted" style={{ fontSize: 13, fontWeight: 400 }}>{pending[p.id] ? 'Saving…' : here ? `In ${clock(p.checkedInAt!)}` : 'Not here'}</span>
            </>
          )
          return (
            <li key={p.id}>
              {canEdit ? (
                <button type="button" className={`adm-btn ${here ? 'accent' : ''}`} aria-pressed={here} aria-busy={!!pending[p.id]}
                  style={{ width: '100%', minHeight: 56, fontSize: 16, justifyContent: 'flex-start', gap: 10 }}
                  onClick={() => onToggle([p], !here, p.name)}>
                  {text}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>{text}</div>
              )}
            </li>
          )
        })}
      </ul>
      {canEdit && missing.length > 1 && (
        <button type="button" className="adm-btn primary" style={{ minHeight: 48 }} aria-disabled={busy}
          onClick={() => onToggle(missing, true, t.name)}>
          Check in the whole team
        </button>
      )}
    </li>
  )
}
