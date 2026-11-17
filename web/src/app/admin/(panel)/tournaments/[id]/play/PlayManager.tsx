'use client'

/**
 * Teams & schedule for one tournament, a division at a time: enter or paste the teams, Save teams,
 * then Make schedule. The server enforces the order (teams lock once a schedule exists; a schedule
 * can't be redone once a score is in) and every action is checked there; this screen explains the
 * locks and shows the server's messages. Unsaved team edits survive live refreshes and switching
 * divisions, and leaving the screen asks first.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { clearScheduleAction, drawPlayoffsAction, generateScheduleAction, resetPlayoffsAction, setTeamsAction, type PlayResult } from '@/app/admin/play-actions'
import { BRACKET_SIZE } from '@/lib/match/bracket'
import { parsePastedTeams, type PasteResult } from '@/lib/match/pasteTeams'
import { STAGE_ORDER } from '@/lib/match/present'
import { describePlan, formatTime12, scheduleDivision } from '@/lib/match/schedule'
import type { Match, MatchStatus } from '@/lib/play/repo'

export type PlayTeam = { id: number; name: string; players: { id: number; name: string; dupr: string }[] }
export type PlayDivision = {
  id: number
  name: string
  formatLabel: string
  dayLabel: string | null
  startTime: string
  gamesTo: number
  gamesPerTeam: number
  winBy2: boolean
  minutesPerRound: number
  firstCourt: number
  courtCount: number
  teamLimit: number | null
  playoffs: 'none' | 'top4' | 'top8'
  bronze: 'standings' | 'match'
  playoffGamesTo: number
  teams: PlayTeam[]
  matches: Match[]
}

type PlayerRow = { key: string; id?: number; name: string; dupr: string }
type TeamRow = { key: string; id?: number; name: string; players: PlayerRow[] }
type Errors = Record<string, string>
type Note = { ok: boolean; text: string; where: 'teams' | 'schedule' | 'playoffs' }
type Busy = 'teams' | 'make' | 'clear' | 'draw' | 'reset' | null

const MAX_TEAMS = 64
const MAX_PLAYERS = 4
const NO_ERRORS: Errors = {}
const STATUS: Record<MatchStatus, string> = { scheduled: 'Not started', live: 'Live', final: 'Final' }

let seq = 0
const newKey = (p: string) => `${p}n${++seq}`
const toRows = (teams: PlayTeam[]): TeamRow[] =>
  teams.map((t) => ({ key: `t${t.id}`, id: t.id, name: t.name, players: t.players.map((p) => ({ key: `p${p.id}`, id: p.id, name: p.name, dupr: p.dupr })) }))
/** What a save would send, as text: equal means nothing to save. */
const canon = (rows: TeamRow[]) =>
  JSON.stringify(rows.map((t) => [t.id ?? null, t.name.trim(), t.players.map((p) => [p.id ?? null, p.name.trim(), p.dupr.trim()])]))
const blankTeam = (): TeamRow => ({ key: newKey('t'), name: '', players: [{ key: newKey('p'), name: '', dupr: '' }, { key: newKey('p'), name: '', dupr: '' }] })
const isScored = (m: Match) => m.scoreA !== null || m.scoreB !== null || m.status !== 'scheduled'

/** Runs a Server Action; a dropped connection becomes a message instead of an unhandled error. */
async function call(fn: () => Promise<PlayResult>): Promise<PlayResult> {
  try {
    return await fn()
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection, or sign in again, then try again.' }
  }
}

function validate(rows: TeamRow[]): Errors {
  const e: Errors = {}
  if (rows.length > MAX_TEAMS) e._ = `Up to ${MAX_TEAMS} teams per division.`
  rows.forEach((t, i) => {
    if (!t.name.trim()) e[`${i}.name`] = 'Enter a team name.'
    if (!t.players.length) e[`${i}.players`] = 'Each team needs at least one player.'
    t.players.forEach((p, j) => {
      if (!p.name.trim()) e[`${i}.players.${j}.name`] = 'Enter the player’s name, or remove this player.'
    })
  })
  return e
}

/* ---------- the screen ---------- */

export function PlayManager({ divisions, canEdit }: { divisions: PlayDivision[]; canEdit: boolean }) {
  const [active, setActive] = useState(divisions[0].id)
  // panels stay mounted once opened, so unsaved edits survive switching divisions
  const [opened, setOpened] = useState<number[]>([divisions[0].id])
  const [dirtyIds, setDirtyIds] = useState<number[]>([])
  const current = divisions.find((d) => d.id === active) ?? divisions[0]

  const onDirty = useCallback((id: number, dirty: boolean) => {
    setDirtyIds((prev) => (dirty ? (prev.includes(id) ? prev : [...prev, id]) : prev.includes(id) ? prev.filter((x) => x !== id) : prev))
  }, [])

  const anyDirty = dirtyIds.length > 0
  useEffect(() => {
    if (!anyDirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    document.body.dataset.unsaved = '1' // AdminNav and LeaveLink ask before leaving
    return () => { window.removeEventListener('beforeunload', warn); delete document.body.dataset.unsaved }
  }, [anyDirty])

  const pick = (id: number) => {
    setActive(id)
    setOpened((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {divisions.length > 1 && (
        <div role="group" aria-label="Division" className="adm-actions">
          {divisions.map((d) => {
            const state = d.matches.length === 0 ? 'no schedule' : d.matches.some(isScored) ? 'scoring' : 'scheduled'
            return (
              <button key={d.id} type="button" className={`adm-btn ${d.id === current.id ? 'primary' : ''}`} aria-pressed={d.id === current.id}
                aria-controls={`play-div-${d.id}`} onClick={() => pick(d.id)} style={{ minHeight: 48, flexDirection: 'column', alignItems: 'flex-start', gap: 0, padding: '6px 14px' }}>
                <span>{d.name}{dirtyIds.includes(d.id) && <span aria-hidden="true"> •</span>}</span>
                <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>
                  {d.teams.length} {d.teams.length === 1 ? 'team' : 'teams'} · {state}
                  {dirtyIds.includes(d.id) && <span className="sr">, unsaved changes</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {divisions.map((d) =>
        opened.includes(d.id) || d.id === current.id ? (
          <DivisionPanel key={d.id} d={d} hidden={d.id !== current.id} canEdit={canEdit} onDirty={onDirty} />
        ) : null,
      )}
    </div>
  )
}

/* ---------- one division ---------- */

function DivisionPanel({ d, hidden, canEdit, onDirty }: { d: PlayDivision; hidden: boolean; canEdit: boolean; onDirty: (id: number, dirty: boolean) => void }) {
  const uid = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const scheduleHeadRef = useRef<HTMLHeadingElement>(null)
  const teamsHeadRef = useRef<HTMLHeadingElement>(null)
  const playoffsHeadRef = useRef<HTMLHeadingElement>(null)

  const hasSchedule = d.matches.length > 0
  const scored = d.matches.some(isScored)
  const editable = canEdit && !hasSchedule

  const serverKey = canon(toRows(d.teams))
  const [rows, setRowsRaw] = useState(() => toRows(d.teams))
  /** the saved list the rows are compared with */
  const [saved, setSaved] = useState(serverKey)
  const [lastServer, setLastServer] = useState(serverKey)
  const [errors, setErrors] = useState<Errors>(NO_ERRORS)
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [clash, setClash] = useState(false)
  const dirty = editable && canon(rows) !== saved

  // someone saved (here or elsewhere): take the new list unless there are edits to keep
  if (serverKey !== lastServer) {
    setLastServer(serverKey)
    if (!dirty) {
      setRowsRaw(toRows(d.teams))
      setSaved(serverKey)
      setClash(false)
    } else {
      setClash(true)
    }
  }

  useEffect(() => {
    onDirty(d.id, dirty)
  }, [d.id, dirty, onDirty])
  useEffect(() => () => onDirty(d.id, false), [d.id, onDirty])

  // editing clears old messages (server errors are keyed by position and go stale after a reorder)
  const setRows = (fn: (r: TeamRow[]) => TeamRow[]) => {
    setRowsRaw(fn)
    setErrors(NO_ERRORS)
    setNote((n) => (n?.where === 'teams' ? null : n))
  }
  // the same text twice is not read out again, so nudge it
  const say = (n: Note) => setNote((prev) => (prev && prev.text === n.text && prev.where === n.where ? { ...n, text: `${n.text} ` } : n))
  const focusPath = (path: string) => {
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>(`[data-path="${path}"]`)?.focus())
  }

  const updateTeam = (key: string, patch: (t: TeamRow) => TeamRow) => setRows((r) => r.map((t) => (t.key === key ? patch(t) : t)))
  const move = (i: number, dir: -1 | 1, focusId: string) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    setRows((r) => {
      const next = [...r]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    say({ ok: true, text: `${rows[i].name.trim() || `Team ${i + 1}`} moved to position ${j + 1}.`, where: 'teams' })
    requestAnimationFrame(() => document.getElementById(focusId)?.focus())
  }
  const removeTeam = (i: number) => {
    const name = rows[i].name.trim() || `Team ${i + 1}`
    setRows((r) => r.filter((_, k) => k !== i))
    say({ ok: true, text: `Removed ${name}. Save teams to keep this change.`, where: 'teams' })
    teamsHeadRef.current?.focus()
  }
  const addTeam = () => {
    if (rows.length >= MAX_TEAMS) return say({ ok: false, text: `Up to ${MAX_TEAMS} teams per division.`, where: 'teams' })
    const t = blankTeam()
    setRows((r) => [...r, t])
    focusPath(`${rows.length}.name`)
  }
  const addPasted = (teams: TeamRow[]) => {
    if (rows.length + teams.length > MAX_TEAMS) {
      say({ ok: false, text: `That would make ${rows.length + teams.length} teams; a division takes up to ${MAX_TEAMS}.`, where: 'teams' })
      return false
    }
    setRows((r) => [...r, ...teams])
    say({ ok: true, text: `Added ${teams.length} ${teams.length === 1 ? 'team' : 'teams'} to the end of the list. Check them, then Save teams.`, where: 'teams' })
    return true
  }

  const saveTeams = async () => {
    if (busy || !dirty) return
    const errs = validate(rows)
    if (Object.keys(errs).length) {
      setErrors(errs)
      say({ ok: false, text: 'Fix the highlighted fields.', where: 'teams' })
      focusPath(Object.keys(errs)[0])
      return
    }
    setBusy('teams')
    const sent = canon(rows)
    const payload = rows.map((t) => ({
      ...(t.id !== undefined ? { id: t.id } : {}),
      name: t.name.trim(),
      players: t.players.map((p) => ({ ...(p.id !== undefined ? { id: p.id } : {}), name: p.name.trim(), dupr: p.dupr.trim() })),
    }))
    const res = await call(() => setTeamsAction(d.id, payload))
    setBusy(null)
    if (res.ok) {
      setSaved(sent) // the refreshed list (with the new teams' ids) replaces the rows when it arrives
      setClash(false)
    } else if (res.errors) {
      setErrors(res.errors)
      const first = Object.keys(res.errors)[0]
      if (first) focusPath(first)
    }
    say({ ok: res.ok, text: res.message, where: 'teams' })
  }

  const makeSchedule = async () => {
    if (busy) return
    if (hasSchedule && !window.confirm(`Make a new schedule for ${d.name}?\n\nThe current ${d.matches.length} matches are replaced by a new random draw.`)) return
    setBusy('make')
    const res = await call(() => generateScheduleAction(d.id))
    setBusy(null)
    say({ ok: res.ok, text: res.message, where: 'schedule' })
    scheduleHeadRef.current?.focus() // the buttons change once the schedule exists
  }
  const clearSchedule = async () => {
    if (busy) return
    if (!window.confirm(`Clear the schedule for ${d.name}?\n\nIts ${d.matches.length} matches are removed so the teams can be changed.`)) return
    setBusy('clear')
    const res = await call(() => clearScheduleAction(d.id))
    setBusy(null)
    say({ ok: res.ok, text: res.message, where: 'schedule' })
    scheduleHeadRef.current?.focus()
  }

  const pool = d.matches.filter((m) => m.stage === 'pool')
  const playoff = d.matches.filter((m) => m.stage !== 'pool')
  const poolDone = pool.length > 0 && pool.every((m) => m.status === 'final')
  const playoffScored = playoff.some(isScored)
  const bracketSize = d.playoffs === 'none' ? 0 : BRACKET_SIZE[d.playoffs]

  const drawPlayoffs = async () => {
    if (busy) return
    setBusy('draw')
    const res = await call(() => drawPlayoffsAction(d.id))
    setBusy(null)
    say({ ok: res.ok, text: res.message, where: 'playoffs' })
    playoffsHeadRef.current?.focus()
  }
  const resetPlayoffs = async () => {
    if (busy) return
    if (!window.confirm(`Reset the playoffs for ${d.name}?\n\nIts ${playoff.length} playoff games are removed. You can draw them again from the final standings.`)) return
    setBusy('reset')
    const res = await call(() => resetPlayoffsAction(d.id))
    setBusy(null)
    say({ ok: res.ok, text: res.message, where: 'playoffs' })
    playoffsHeadRef.current?.focus()
  }

  const facts = [
    d.formatLabel,
    d.dayLabel,
    `starts ${formatTime12(d.startTime)}`,
    `games to ${d.gamesTo}${d.winBy2 ? ', win by 2' : ''}`,
    `${d.gamesPerTeam} ${d.gamesPerTeam === 1 ? 'game' : 'games'} per team`,
  ].filter(Boolean)
  const savedCount = d.teams.length
  const overLimit = d.teamLimit !== null && rows.length > d.teamLimit

  return (
    <div id={`play-div-${d.id}`} ref={panelRef} hidden={hidden} role="region" aria-labelledby={`${uid}-h`} style={{ display: hidden ? 'none' : 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h2 id={`${uid}-h`} style={{ fontSize: 22 }}>{d.name}</h2>
        <p className="adm-muted">{facts.join(' · ')}</p>
      </div>

      {/* ---- teams ---- */}
      <section className="adm-card" aria-labelledby={`${uid}-teams-h`} style={{ display: 'grid', gap: 14 }}>
        <h3 id={`${uid}-teams-h`} ref={teamsHeadRef} tabIndex={-1} style={{ fontSize: 17 }}>
          Teams ({editable ? rows.length : savedCount}){d.teamLimit !== null ? ` of ${d.teamLimit}` : ''}
        </h3>

        {hasSchedule && (
          <p className="adm-locknote" role="note">
            {scored
              ? 'Scores are in, so the teams and the schedule are locked.'
              : canEdit
                ? 'The teams are locked while this division has a schedule. Clear the schedule (below) to change them.'
                : 'The teams are locked while this division has a schedule.'}
          </p>
        )}
        {clash && dirty && (
          <p className="adm-locknote" role="note">
            Someone else saved this division’s teams while you were editing. Saving replaces their list with yours.
          </p>
        )}

        {editable ? (
          <>
            {rows.length === 0 ? (
              <p className="adm-muted">No teams yet. Add them one at a time or paste them from a spreadsheet.</p>
            ) : (
              <ol className="adm-list" style={{ gap: 10 }}>
                {rows.map((t, i) => (
                  <TeamEditor key={t.key} uid={uid} team={t} index={i} count={rows.length} errors={errors}
                    onChange={(patch) => updateTeam(t.key, patch)} onMove={(dir, focusId) => move(i, dir, focusId)} onRemove={() => removeTeam(i)} />
                ))}
              </ol>
            )}
            {errors._ && <p className="adm-note bad">{errors._}</p>}
            {overLimit && <p className="adm-note bad">This division is set to {d.teamLimit} teams; the list has {rows.length}.</p>}
            <div className="adm-actions">
              <button type="button" className="adm-btn" onClick={addTeam}>+ Add team</button>
            </div>
            <PasteTeams onAdd={addPasted} />
            <div className="adm-save" style={{ marginTop: 0 }}>
              <p role="status" className={`msg ${note?.where === 'teams' ? (note.ok ? 'good' : 'bad') : ''}`}>
                {busy === 'teams' ? 'Saving…' : note?.where === 'teams' ? note.text : dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}
              </p>
              <button type="button" className="adm-btn primary" aria-disabled={!dirty || busy !== null} onClick={saveTeams}>
                {busy === 'teams' ? 'Saving…' : 'Save teams'}
              </button>
            </div>
          </>
        ) : savedCount === 0 ? (
          <p className="adm-muted">No teams yet.</p>
        ) : (
          <TeamTable teams={d.teams} caption={`${d.name} teams`} />
        )}
      </section>

      {/* ---- schedule ---- */}
      <section className="adm-card" aria-labelledby={`${uid}-sched-h`} style={{ display: 'grid', gap: 14 }}>
        <h3 id={`${uid}-sched-h`} ref={scheduleHeadRef} tabIndex={-1} style={{ fontSize: 17 }}>
          Schedule{hasSchedule ? ` (${d.matches.length} matches)` : ''}
        </h3>

        {!hasSchedule && (savedCount < 2 ? (
          <p className="adm-muted">Add at least two teams and save them; then you can make the schedule here.</p>
        ) : (
          <>
            <p>{describePlan(savedCount, d.gamesPerTeam)}</p>
            <p className="adm-muted">{timing(d, savedCount)}</p>
            {dirty && <p className="adm-locknote" role="note">Save the teams first: the schedule is made from the saved list.</p>}
          </>
        ))}
        {hasSchedule && scored && (
          <p className="adm-locknote" role="note">Scores are in, so this schedule can’t be made again or cleared.</p>
        )}

        {canEdit && !scored && savedCount >= 2 && (
          <div className="adm-actions">
            <button type="button" className={`adm-btn ${hasSchedule ? '' : 'primary'}`} aria-disabled={busy !== null || dirty} onClick={() => { if (!dirty) void makeSchedule() }}>
              {busy === 'make' ? 'Making…' : hasSchedule ? 'Make schedule again' : 'Make schedule'}
            </button>
            {hasSchedule && (
              <button type="button" className="adm-btn danger" aria-disabled={busy !== null} onClick={clearSchedule}>
                {busy === 'clear' ? 'Clearing…' : 'Clear schedule'}
              </button>
            )}
          </div>
        )}
        <p role="status" className={`adm-note ${note?.where === 'schedule' ? (note.ok ? 'good' : 'bad') : ''}`}>
          {note?.where === 'schedule' ? note.text : ''}
        </p>

        {hasSchedule && <ScheduleTable d={d} />}
      </section>

      {/* ---- playoffs ---- */}
      {(d.playoffs !== 'none' || playoff.length > 0) && (
        <section className="adm-card" aria-labelledby={`${uid}-po-h`} style={{ display: 'grid', gap: 14 }}>
          <h3 id={`${uid}-po-h`} ref={playoffsHeadRef} tabIndex={-1} style={{ fontSize: 17 }}>
            Playoffs{bracketSize ? `: top ${bracketSize}` : ''}{playoff.length ? ` (${playoff.length} games)` : ''}
          </h3>
          <p className="adm-muted">
            {bracketSize === 8 ? 'Quarterfinals 1 v 8, 4 v 5, 2 v 7, 3 v 6, then semifinals and the final' : 'Semifinals 1 v 4 and 2 v 3, then the final'}
            {d.bronze === 'match' ? ', plus a bronze match between the semifinal losers' : '; bronze goes to the semifinal loser who finished higher in the pool'}.
            {' '}Playoff games are played to {d.playoffGamesTo}{d.winBy2 ? ', win by 2' : ''}.
          </p>

          {playoff.length > 0 ? (
            <p>Drawn from the final pool standings. Winners move on by themselves as each game goes final; the games are in the schedule above.</p>
          ) : d.teams.length < bracketSize ? (
            <p className="adm-locknote" role="note">
              Top {bracketSize} playoffs need at least {bracketSize} teams; this division has {d.teams.length}.
              {canEdit ? ' Change the playoff format in the tournament details, or add teams.' : ''}
            </p>
          ) : !poolDone ? (
            <p>The bracket is drawn by itself the moment the last pool game goes final.</p>
          ) : (
            <p className="adm-locknote" role="note">Pool play is finished but the bracket isn’t drawn yet.</p>
          )}
          {playoffScored && <p className="adm-locknote" role="note">Playoff games have scores, so the playoffs can’t be reset.</p>}

          {canEdit && (playoff.length === 0 ? poolDone && d.teams.length >= bracketSize : !playoffScored) && (
            <div className="adm-actions">
              {playoff.length === 0 ? (
                <button type="button" className="adm-btn primary" aria-disabled={busy !== null} onClick={drawPlayoffs}>
                  {busy === 'draw' ? 'Drawing…' : 'Draw playoffs'}
                </button>
              ) : (
                <button type="button" className="adm-btn danger" aria-disabled={busy !== null} onClick={resetPlayoffs}>
                  {busy === 'reset' ? 'Resetting…' : 'Reset playoffs'}
                </button>
              )}
            </div>
          )}
          <p role="status" className={`adm-note ${note?.where === 'playoffs' ? (note.ok ? 'good' : 'bad') : ''}`}>
            {note?.where === 'playoffs' ? note.text : ''}
          </p>
        </section>
      )}
    </div>
  )
}

/** "Courts 1–4 from 9:00 AM: 6 time slots of 20 minutes; the last games start at 10:40 AM." */
function timing(d: PlayDivision, teamCount: number): string {
  const plan = scheduleDivision({
    teamIds: Array.from({ length: teamCount }, (_, i) => i + 1),
    gamesPerTeam: d.gamesPerTeam,
    startTime: d.startTime,
    minutesPerRound: d.minutesPerRound,
    firstCourt: d.firstCourt,
    courtCount: d.courtCount,
    seed: 1,
  })
  if (!plan.length) return ''
  const slots = Math.max(...plan.map((m) => m.slot))
  const last = plan[plan.length - 1].startsAt
  const courts = d.courtCount === 1 ? `Court ${d.firstCourt}` : `Courts ${d.firstCourt}–${d.firstCourt + d.courtCount - 1}`
  return `${courts} from ${formatTime12(d.startTime)}: ${slots} time ${slots === 1 ? 'slot' : 'slots'} of ${d.minutesPerRound} minutes; the last games start at ${formatTime12(last)}.`
}

/* ---------- team editing ---------- */

function TeamEditor({ uid, team, index, count, errors, onChange, onMove, onRemove }: {
  uid: string
  team: TeamRow
  index: number
  count: number
  errors: Errors
  onChange: (patch: (t: TeamRow) => TeamRow) => void
  onMove: (dir: -1 | 1, focusId: string) => void
  onRemove: () => void
}) {
  const base = `${uid}-${team.key}`
  const label = team.name.trim() || `Team ${index + 1}`
  const nameErr = errors[`${index}.name`]
  const playersErr = errors[`${index}.players`]
  const setPlayer = (key: string, patch: Partial<PlayerRow>) =>
    onChange((t) => ({ ...t, players: t.players.map((p) => (p.key === key ? { ...p, ...patch } : p)) }))

  return (
    <li className="adm-item">
      <div role="group" aria-label={`Team ${index + 1}`} style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <div className="adm-field" style={{ flex: '1 1 220px', minWidth: 0 }}>
            <label htmlFor={`${base}-name`}>Team {index + 1} name</label>
            <input id={`${base}-name`} data-path={`${index}.name`} className="adm-input" value={team.name} maxLength={60} autoComplete="off"
              aria-invalid={!!nameErr} aria-describedby={nameErr ? `${base}-name-err` : undefined}
              onChange={(e) => { const v = e.target.value; onChange((t) => ({ ...t, name: v })) }} />
            {nameErr && <p className="err" id={`${base}-name-err`}>{nameErr}</p>}
          </div>
          <div className="adm-actions" style={{ gap: 6 }}>
            <button id={`${base}-up`} type="button" className="adm-btn icon" aria-label={`Move ${label} up`} aria-disabled={index === 0}
              onClick={() => onMove(-1, `${base}-up`)}>↑</button>
            <button id={`${base}-down`} type="button" className="adm-btn icon" aria-label={`Move ${label} down`} aria-disabled={index === count - 1}
              onClick={() => onMove(1, `${base}-down`)}>↓</button>
            <button type="button" className="adm-btn danger" style={{ minHeight: 40 }} onClick={onRemove}>
              Remove<span className="sr"> {label}</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {team.players.map((p, j) => {
            const pErr = errors[`${index}.players.${j}.name`]
            const dErr = errors[`${index}.players.${j}.dupr`]
            const pid = `${base}-${p.key}`
            return (
              <div key={p.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px auto', gap: 8, alignItems: 'end' }}>
                <div className="adm-field" style={{ minWidth: 0 }}>
                  <label htmlFor={`${pid}-name`} style={{ fontSize: 13 }}>Player {j + 1}<span className="sr"> of {label}</span></label>
                  <input id={`${pid}-name`} data-path={`${index}.players.${j}.name`} className="adm-input" value={p.name} maxLength={60} autoComplete="off"
                    aria-invalid={!!pErr} aria-describedby={pErr ? `${pid}-name-err` : undefined}
                    onChange={(e) => setPlayer(p.key, { name: e.target.value })} />
                </div>
                <div className="adm-field">
                  <label htmlFor={`${pid}-dupr`} style={{ fontSize: 13 }}>DUPR<span className="sr"> for player {j + 1} of {label}</span></label>
                  <input id={`${pid}-dupr`} data-path={`${index}.players.${j}.dupr`} className="adm-input" value={p.dupr} maxLength={10} autoComplete="off" inputMode="decimal"
                    aria-invalid={!!dErr} aria-describedby={dErr ? `${pid}-dupr-err` : undefined}
                    onChange={(e) => setPlayer(p.key, { dupr: e.target.value })} />
                </div>
                <button type="button" className="adm-btn icon" aria-label={`Remove player ${j + 1} of ${label}`} aria-disabled={team.players.length <= 1}
                  onClick={() => { if (team.players.length > 1) onChange((t) => ({ ...t, players: t.players.filter((x) => x.key !== p.key) })) }}>
                  ×
                </button>
                {pErr && <p className="adm-note bad" id={`${pid}-name-err`} style={{ gridColumn: '1 / -1', fontSize: 13 }}>{pErr}</p>}
                {dErr && <p className="adm-note bad" id={`${pid}-dupr-err`} style={{ gridColumn: '1 / -1', fontSize: 13 }}>{dErr}</p>}
              </div>
            )
          })}
          {playersErr && <p className="adm-note bad" id={`${base}-players-err`}>{playersErr}</p>}
          {team.players.length < MAX_PLAYERS && (
            <div>
              <button type="button" className="adm-btn small" data-path={`${index}.players`} aria-describedby={playersErr ? `${base}-players-err` : undefined}
                onClick={() => onChange((t) => ({ ...t, players: [...t.players, { key: newKey('p'), name: '', dupr: '' }] }))}>
                + Add player<span className="sr"> to {label}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

/** Paste cells from a spreadsheet, preview what was understood, then add the teams to the list. */
function PasteTeams({ onAdd }: { onAdd: (teams: TeamRow[]) => boolean }) {
  const id = useId()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PasteResult | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)

  const nameOf = (t: PasteResult['teams'][number]) => (t.name.trim() || t.players.map((p) => p.name).join(' / ')).slice(0, 60)
  const show = () => {
    setPreview(parsePastedTeams(text))
    requestAnimationFrame(() => addRef.current?.focus())
  }
  const add = () => {
    if (!preview?.teams.length) return
    const rows: TeamRow[] = preview.teams.map((t) => ({
      key: newKey('t'),
      name: nameOf(t),
      players: t.players.map((p) => ({ key: newKey('p'), name: p.name.slice(0, 60), dupr: p.dupr.slice(0, 10) })),
    }))
    if (onAdd(rows)) {
      setText('')
      setPreview(null)
      boxRef.current?.focus()
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10, paddingTop: 14, borderTop: '1px dashed rgb(var(--ink-dark-rgb) / .18)' }}>
      <div className="adm-field">
        <label htmlFor={id}>Paste teams</label>
        <textarea ref={boxRef} id={id} className="adm-input" rows={5} value={text} aria-describedby={`${id}-hint`} spellCheck={false}
          onChange={(e) => { setText(e.target.value); setPreview(null) }} />
        <p className="hint" id={`${id}-hint`}>
          Copy the cells from Google Sheets or Excel and paste them here. Either one team per row (team name, player, DUPR, player, DUPR)
          or one player per row works; header rows are skipped.
        </p>
      </div>
      <div className="adm-actions">
        <button type="button" className="adm-btn" aria-disabled={!text.trim()} onClick={() => { if (text.trim()) show() }}>Preview</button>
      </div>
      {preview && (
        <div role="region" aria-label="Pasted teams preview" style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10, background: 'rgb(var(--ink-dark-rgb) / .05)' }}>
          <p style={{ fontWeight: 600 }}>
            {preview.teams.length === 0
              ? 'No teams found. Check that each row has player names.'
              : `Found ${preview.teams.length} ${preview.teams.length === 1 ? 'team' : 'teams'}.`}
          </p>
          {preview.unpaired && <p className="adm-note bad">“{preview.unpaired}” has no partner, so they were left out.</p>}
          {preview.teams.length > 0 && (
            <ol style={{ display: 'grid', gap: 4, paddingLeft: 22, margin: 0 }}>
              {preview.teams.map((t, i) => (
                <li key={i}>
                  <strong>{nameOf(t)}</strong>
                  <span className="adm-muted">: {t.players.map((p) => (p.dupr ? `${p.name} (${p.dupr})` : p.name)).join(', ')}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="adm-actions">
            {preview.teams.length > 0 && (
              <button ref={addRef} type="button" className="adm-btn primary" onClick={add}>
                Add {preview.teams.length} {preview.teams.length === 1 ? 'team' : 'teams'}
              </button>
            )}
            <button type="button" className="adm-btn" onClick={() => { setPreview(null); boxRef.current?.focus() }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- read-only views ---------- */

function TeamTable({ teams, caption }: { teams: PlayTeam[]; caption: string }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} style={{ overflowX: 'auto' }}>
      <table className="adm-table">
        <caption className="sr">{caption}</caption>
        <thead>
          <tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">Players (DUPR)</th></tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <tr key={t.id}>
              <td>{i + 1}</td>
              <th scope="row" style={{ fontSize: 14, textTransform: 'none', letterSpacing: 0, color: 'inherit' }}>{t.name}</th>
              <td>{t.players.map((p) => (p.dupr ? `${p.name} (${p.dupr})` : p.name)).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const STAGES: Record<Match['stage'], string> = { pool: 'Round', qf: 'Quarterfinals', sf: 'Semifinals', final: 'Final', bronze: 'Bronze match' }

function ScheduleTable({ d }: { d: PlayDivision }) {
  const names = new Map(d.teams.map((t) => [t.id, t.name]))
  const team = (id: number | null) => (id === null ? 'To be decided' : names.get(id) ?? 'Removed team')
  // one block per round (or playoff stage), each in time-slot then court order
  const groups = new Map<string, Match[]>()
  for (const m of [...d.matches].sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.round - b.round || a.slot - b.slot || (a.court ?? 0) - (b.court ?? 0) || a.id - b.id)) {
    const key = m.stage === 'pool' ? `Round ${m.round}` : STAGES[m.stage]
    const list = groups.get(key)
    if (list) list.push(m)
    else groups.set(key, [m])
  }
  return (
    <div role="region" aria-label={`${d.name} schedule`} tabIndex={0} style={{ overflowX: 'auto' }}>
      <table className="adm-table" style={{ minWidth: 560 }}>
        <caption className="sr">{d.name} schedule, by round</caption>
        <thead>
          <tr>
            <th scope="col">Time</th><th scope="col">Court</th><th scope="col">Team A</th><th scope="col">Team B</th><th scope="col">Score</th><th scope="col">Status</th>
          </tr>
        </thead>
        {[...groups.entries()].map(([label, list]) => (
          <tbody key={label}>
            <tr>
              <th scope="colgroup" colSpan={6} style={{ background: 'rgb(var(--ink-dark-rgb) / .05)', color: 'inherit' }}>{label}</th>
            </tr>
            {list.map((m) => (
              <tr key={m.id}>
                <td>{m.startsAt ? formatTime12(m.startsAt) : '–'}</td>
                <td>{m.court ?? '–'}</td>
                <td>{team(m.teamAId)}</td>
                <td>{team(m.teamBId)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{m.scoreA === null && m.scoreB === null ? '–' : `${m.scoreA ?? 0}–${m.scoreB ?? 0}`}</td>
                <td>{STATUS[m.status]}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
