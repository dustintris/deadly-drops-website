'use client'

/**
 * Staff logins: the list, "Add a login" and, per login, name and access, a new password,
 * disable/enable and delete. The controls follow the server's rules (staff-actions.ts) so nobody
 * is offered something that will be refused, but the server decides.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { createStaff, deleteStaff, resetStaffPassword, setStaffDisabled, updateStaff, type StaffResult } from '@/app/admin/staff-actions'
import { AREA_HELP, AREA_LABELS, AREAS, LEVELS, normalizePerms, PRESETS, presetOf, withinCeiling, type Area, type Level, type Perms } from '@/lib/auth/permissions'
import type { StaffUser } from '@/lib/auth/users'

type Me = { id: number; isOwner: boolean; perms: Perms }
/** What this person may hand out: anything for the owner, otherwise at most their own level per area. */
const ceilingOf = (me: Me): Perms | undefined => (me.isOwner ? undefined : me.perms)
const rank = (l: Level) => LEVELS.indexOf(l)
type Note = { ok: boolean; text: string }
type Errors = Record<string, string>
/** Role picker state: a preset key, 'custom', or '' (not chosen yet). `open` shows every area. */
type Access = { choice: string; perms: Perms; open: boolean }

const MIN_PASSWORD = 12
const LEVEL_TEXT: Record<Level, string> = { none: 'No access', view: 'View only', edit: 'Can change' }
const NOT_CHOSEN: Access = { choice: '', perms: normalizePerms({}), open: false }
const ROLE_OPTIONS = [
  ...PRESETS.map(({ key, label, description }) => ({ key, label, description })),
  { key: 'custom', label: 'Custom', description: 'Choose the access for each area yourself' },
]

function accessFrom(perms: Perms): Access {
  const choice = presetOf(perms)
  return { choice, perms, open: choice === 'custom' }
}
const permsKey = (p: Perms) => AREAS.map((a) => p[a]).join(',')

function roleLabel(u: { isOwner: boolean; perms: Perms }): string {
  if (u.isOwner) return 'Owner'
  return PRESETS.find((p) => p.key === presetOf(u.perms))?.label ?? 'Custom'
}

function accessSummary(u: StaffUser): string {
  if (u.isOwner) return 'Full access to every area, including staff accounts.'
  const areas = (level: Level) => AREAS.filter((a) => u.perms[a] === level).map((a) => AREA_LABELS[a]).join(', ')
  const parts = [areas('edit') && `Can change: ${areas('edit')}.`, areas('view') && `Can view: ${areas('view')}.`].filter(Boolean)
  return parts.length ? parts.join(' ') : 'No access to any area yet.'
}

const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
/** "3 hours ago", or a date once it is a month old. `now` comes from the server so both renders agree. */
function lastSignIn(iso: string, now: number): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'unknown'
  const s = Math.round((t - now) / 1000)
  const ago = Math.abs(s)
  if (ago < 60) return 'just now'
  if (ago < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (ago < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  if (ago < 30 * 86400) return rtf.format(Math.round(s / 86400), 'day')
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// no look-alikes (0/o, 1/l/i): it is read out in person or over the phone
const PW_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'
/** 20 random characters in groups of 5 (about 99 bits), e.g. "k7m2p-x9q4r-...". */
function generatePassword(): string {
  const want = 20
  const limit = 256 - (256 % PW_CHARS.length) // skip the top bytes so every character is equally likely
  const chars: string[] = []
  while (chars.length < want) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && chars.length < want) chars.push(PW_CHARS[b % PW_CHARS.length])
    }
  }
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join('')).join('-')
}

/** Runs a Server Action; a dropped connection becomes a message instead of an unhandled error. */
async function call(fn: () => Promise<StaffResult>): Promise<StaffResult> {
  try {
    return await fn()
  } catch {
    return { ok: false, message: 'Could not reach the server. Check your connection, or sign in again, then try again.' }
  }
}

/** Server field errors; every permissions problem is shown on the role picker. */
function fieldErrors(raw: Errors | undefined): Errors {
  const out: Errors = {}
  for (const [k, v] of Object.entries(raw ?? {})) out[k.startsWith('perms') ? 'perms' : k] ??= v
  return out
}

function without(errors: Errors, key: string): Errors {
  if (!(key in errors)) return errors
  const { [key]: _, ...rest } = errors
  return rest
}

function focusFirstInvalid(form: HTMLFormElement | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid] input')?.focus())
}

const noteClass = (note: Note | null) => `adm-note ${note ? (note.ok ? 'good' : 'bad') : ''}`

/* ---------- the page ---------- */

export function StaffManager({ users, me, canEdit, now }: { users: StaffUser[]; me: Me; canEdit: boolean; now: number }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [notice, setNotice] = useState('')
  const onDeleted = (message: string) => {
    setNotice(message)
    headingRef.current?.focus() // the deleted login's buttons are gone: land back on the list
  }

  return (
    <>
      <section aria-labelledby="staff-list-h" className="adm-staff-list">
        <h2 id="staff-list-h" ref={headingRef} tabIndex={-1}>Logins ({users.length})</h2>
        {!canEdit && (
          <p className="adm-muted">You can see who has a login. Only someone allowed to change staff accounts can add or change them.</p>
        )}
        <p role="status" className="adm-note good">{notice}</p>
        {users.length === 0 ? (
          <p className="adm-muted">No logins yet.</p>
        ) : (
          <ul className="adm-list">
            {users.map((u) => <LoginCard key={u.id} u={u} me={me} canEdit={canEdit} now={now} onDeleted={onDeleted} />)}
          </ul>
        )}
      </section>
      {canEdit && <AddLogin me={me} />}
    </>
  )
}

/* ---------- one login ---------- */

function LoginCard({ u, me, canEdit, now, onDeleted }: {
  u: StaffUser; me: Me; canEdit: boolean; now: number; onDeleted: (message: string) => void
}) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const who = u.name || u.email
  const isMe = u.id === me.id
  // the same rules the server applies: not the owner, not yourself, and only the owner changes a staff manager
  const othersManager = !me.isOwner && u.perms.staff !== 'none'
  // and a manager who isn't the owner can't change a login that has access they lack
  const beyond = !me.isOwner && !othersManager && !withinCeiling(me, u.perms)
  const manageable = canEdit && !u.isOwner && !isMe && !othersManager && !beyond

  return (
    <li className="adm-item adm-staff">
      <div className="top">
        <div className="adm-staff-head">
          <div className="who">
            <h3>{who}{isMe && <span className="adm-badge">You</span>}</h3>
            {u.name && <p className="adm-muted">{u.email}</p>}
          </div>
          {manageable && (
            <button type="button" className="adm-btn small" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
              Manage<span className="sr"> {who}</span><span aria-hidden="true">{open ? '▴' : '▾'}</span>
            </button>
          )}
        </div>
        <dl className="adm-facts">
          <div><dt>Role</dt><dd>{roleLabel(u)}</dd></div>
          <div>
            <dt>Status</dt>
            <dd><span className={`adm-badge ${u.disabled ? 'bad' : 'on'}`}>{u.disabled ? 'Disabled' : 'Active'}</span></dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{u.lastLoginAt ? <time dateTime={u.lastLoginAt} suppressHydrationWarning>{lastSignIn(u.lastLoginAt, now)}</time> : 'never'}</dd>
          </div>
        </dl>
        <p className="adm-muted">{accessSummary(u)}</p>
        {u.isOwner ? (
          <p className="adm-locknote">The owner account is managed on the server with <code>npm run admin:setup</code>, not here.</p>
        ) : isMe ? (
          <p className="adm-locknote">This is you. You can’t change your own access; <Link href="/admin/account/">change your password in My account</Link>.</p>
        ) : canEdit && othersManager ? (
          <p className="adm-locknote">This person can manage staff accounts, so only the owner can change their login.</p>
        ) : canEdit && beyond ? (
          <p className="adm-locknote">This login has access you don’t have, so only the owner can change it.</p>
        ) : null}
      </div>
      {manageable && (
        <div id={panelId} className="body" hidden={!open}>
          <AccessForm u={u} me={me} />
          <PasswordReset u={u} who={who} />
          <SignInControls u={u} who={who} onDeleted={onDeleted} />
        </div>
      )}
    </li>
  )
}

function AccessForm({ u, me }: { u: StaffUser; me: Me }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [name, setName] = useState(u.name)
  const [access, setAccess] = useState<Access>(() => accessFrom(u.perms))
  const [errors, setErrors] = useState<Errors>({})
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)

  // new values from the server (a save here, or someone else's): take them unless mid-edit
  const incoming = `${u.name}|${permsKey(u.perms)}`
  const [base, setBase] = useState(incoming)
  if (incoming !== base) {
    setBase(incoming)
    if (`${name}|${permsKey(access.perms)}` === base) {
      setName(u.name)
      setAccess(accessFrom(u.perms))
    }
  }
  const dirty = name.trim() !== u.name || permsKey(access.perms) !== permsKey(u.perms)

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    if (!dirty) {
      setNote({ ok: true, text: 'No changes to save.' })
      return
    }
    if (!name.trim()) {
      setErrors({ name: 'Enter a name.' })
      setNote({ ok: false, text: 'Fix the highlighted field.' })
      focusFirstInvalid(formRef.current)
      return
    }
    setBusy(true)
    setNote(null)
    const res = await call(() => updateStaff(u.id, { name, perms: access.perms }))
    setBusy(false)
    setNote({ ok: res.ok, text: res.message })
    setErrors(fieldErrors(res.errors))
    if (res.ok) router.refresh()
    else focusFirstInvalid(formRef.current)
  }

  return (
    <form ref={formRef} onSubmit={save} noValidate className="adm-staff-sec">
      <h4>Name and access</h4>
      <Field label="Name" error={errors.name}>
        {(p) => (
          <input {...p} className="adm-input" value={name} maxLength={80} autoComplete="off" required
            onChange={(e) => { setName(e.target.value); setNote(null); setErrors((x) => without(x, 'name')) }} />
        )}
      </Field>
      <AccessPicker value={access} allowStaff={me.isOwner} ceiling={ceilingOf(me)} error={errors.perms}
        onChange={(v) => { setAccess(v); setNote(null); setErrors((x) => without(x, 'perms')) }} />
      <div className="adm-actions">
        <button type="submit" className="adm-btn primary" aria-disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save changes'}<span className="sr"> for {u.name || u.email}</span>
        </button>
        <p role="status" className={noteClass(note)}>{note?.text ?? (dirty ? 'You have unsaved changes.' : '')}</p>
      </div>
    </form>
  )
}

function PasswordReset({ u, who }: { u: StaffUser; who: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [note, setNote] = useState<Note | null>(null)
  const [handover, setHandover] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters, or press Generate password.`)
      setNote({ ok: false, text: 'Fix the highlighted field.' })
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setNote(null)
    setHandover(null)
    const res = await call(() => resetStaffPassword(u.id, password))
    setBusy(false)
    setNote({ ok: res.ok, text: res.message })
    setError(res.errors?.password)
    if (res.ok) {
      setHandover(password)
      setPassword('')
      router.refresh()
    } else if (res.errors?.password) {
      inputRef.current?.focus()
    }
  }

  return (
    <form onSubmit={submit} noValidate className="adm-staff-sec">
      <h4>Password</h4>
      <p className="adm-muted">Forgotten password? Set a new one here. They are signed out on every device and sign in again with the new one.</p>
      <PasswordField label="New password" value={password} error={error} inputRef={inputRef}
        onChange={(v) => { setPassword(v); setError(undefined) }} />
      <div className="adm-actions">
        <button type="submit" className="adm-btn" aria-disabled={busy}>
          {busy ? 'Setting password…' : 'Set new password'}<span className="sr"> for {who}</span>
        </button>
        <p role="status" className={noteClass(note)}>{note?.text}</p>
      </div>
      {handover && <Handover email={u.email} password={handover} onHide={() => { setHandover(null); inputRef.current?.focus() }} />}
    </form>
  )
}

function SignInControls({ u, who, onDeleted }: { u: StaffUser; who: string; onDeleted: (message: string) => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setNote(null)
    const res = await call(() => setStaffDisabled(u.id, !u.disabled))
    setBusy(false)
    setNote({ ok: res.ok, text: res.message })
    if (res.ok) router.refresh()
  }

  const remove = async () => {
    if (busy) return
    if (!window.confirm(`Delete the login for ${u.email}?\n\nThis can’t be undone. To stop them signing in for now, disable the login instead.`)) return
    setBusy(true)
    setNote(null)
    const res = await call(() => deleteStaff(u.id))
    setBusy(false)
    if (!res.ok) {
      setNote({ ok: false, text: res.message })
      return
    }
    onDeleted(res.message)
    router.refresh()
  }

  return (
    <div className="adm-staff-sec">
      <h4>Sign-in</h4>
      <p className="adm-muted">
        {u.disabled
          ? 'This login is switched off: they can’t sign in until you enable it again.'
          : 'Disabling signs them out on every device at once. You can enable the login again later.'}
      </p>
      <div className="adm-actions">
        <button type="button" className="adm-btn" aria-disabled={busy} onClick={toggle}>
          {u.disabled ? 'Enable login' : 'Disable login'}<span className="sr"> for {who}</span>
        </button>
        <button type="button" className="adm-btn danger" aria-disabled={busy} onClick={remove}>
          Delete login<span className="sr"> for {who}</span>
        </button>
        <p role="status" className={noteClass(note)}>{note?.text}</p>
      </div>
    </div>
  )
}

/* ---------- add a login ---------- */

function AddLogin({ me }: { me: Me }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [access, setAccess] = useState<Access>(NOT_CHOSEN)
  const [errors, setErrors] = useState<Errors>({})
  const [note, setNote] = useState<Note | null>(null)
  const [handover, setHandover] = useState<{ email: string; password: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const clear = (key: string) => setErrors((x) => without(x, key))

  const fail = (message: string, errs: Errors) => {
    setNote({ ok: false, text: message })
    setErrors(errs)
    focusFirstInvalid(formRef.current)
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const local: Errors = {}
    if (!name.trim()) local.name = 'Enter a name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) local.email = 'Enter a valid email address.'
    if (password.length < MIN_PASSWORD) local.password = `Use at least ${MIN_PASSWORD} characters, or press Generate password.`
    if (!access.choice) local.perms = 'Choose a role, or Custom.'
    else if (AREAS.every((a) => access.perms[a] === 'none')) local.perms = 'Give at least one area “View only” or “Can change”.'
    if (Object.keys(local).length) return fail('Fix the highlighted fields.', local)

    setBusy(true)
    setNote(null)
    setHandover(null)
    const res = await call(() => createStaff({ name, email, password, perms: access.perms }))
    setBusy(false)
    if (!res.ok) return fail(res.message, fieldErrors(res.errors))
    setNote({ ok: true, text: res.message })
    setHandover({ email: email.trim().toLowerCase(), password })
    setName('')
    setEmail('')
    setPassword('')
    setAccess(NOT_CHOSEN)
    setErrors({})
    router.refresh()
  }

  return (
    <section className="adm-card" aria-labelledby="staff-add-h">
      <h2 id="staff-add-h">Add a login</h2>
      <p className="adm-muted">
        Give each person their own login: you can see who changed what, and switch one person off without affecting anyone else.
      </p>
      <form ref={formRef} onSubmit={submit} noValidate className="adm-staff-form">
        <div className="adm-grid">
          <Field label="Name" error={errors.name} hint="Shown in the staff list.">
            {(p) => (
              <input {...p} ref={nameRef} className="adm-input" value={name} maxLength={80} autoComplete="off" required
                onChange={(e) => { setName(e.target.value); clear('name') }} />
            )}
          </Field>
          <Field label="Email" error={errors.email} hint="They sign in with this.">
            {(p) => (
              <input {...p} className="adm-input" type="email" inputMode="email" value={email} maxLength={254} required
                autoComplete="off" spellCheck={false} autoCapitalize="none"
                onChange={(e) => { setEmail(e.target.value); clear('email') }} />
            )}
          </Field>
        </div>
        <PasswordField label="Temporary password" value={password} error={errors.password} inputRef={passwordRef}
          onChange={(v) => { setPassword(v); clear('password') }} />
        <AccessPicker value={access} allowStaff={me.isOwner} ceiling={ceilingOf(me)} error={errors.perms}
          onChange={(v) => { setAccess(v); clear('perms') }} />
        <div className="adm-actions">
          <button type="submit" className="adm-btn primary" aria-disabled={busy}>{busy ? 'Creating login…' : 'Create login'}</button>
          <p role="status" className={noteClass(note)}>{note?.text}</p>
        </div>
        {handover && (
          <Handover email={handover.email} password={handover.password}
            onHide={() => { setHandover(null); nameRef.current?.focus() }} />
        )}
      </form>
    </section>
  )
}

/* ---------- shared pieces ---------- */

type FieldProps = { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }

/** A labelled field; the error and hint are tied to the input so screen readers read them. */
function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: (p: FieldProps) => React.ReactNode
}) {
  const id = useId()
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {error && <p className="err" id={`${id}-err`}>{error}</p>}
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  )
}

/** Shown in plain text so it can be read out; "Generate password" fills a strong random one. */
function PasswordField({ label, value, onChange, error, inputRef }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const generate = () => {
    onChange(generatePassword())
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
  }
  return (
    <Field label={label} error={error}
      hint={`At least ${MIN_PASSWORD} characters, shown as you type. Hand it over in person or by phone, never by email or text message.`}>
      {(p) => (
        <div className="adm-pw">
          <input {...p} ref={inputRef} className="adm-input adm-mono" type="text" value={value} maxLength={200} required
            autoComplete="off" spellCheck={false} autoCapitalize="none" autoCorrect="off"
            onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="adm-btn" onClick={generate}>Generate password</button>
        </div>
      )}
    </Field>
  )
}

function Handover({ email, password, onHide }: { email: string; password: string; onHide: () => void }) {
  return (
    <div className="adm-handover">
      <p><strong>Password for {email}</strong></p>
      <p className="adm-secret adm-mono">{password}</p>
      <p className="adm-muted">
        Read it out in person or by phone, not by email or text. Once signed in, they can choose their own password under My account.
      </p>
      <div><button type="button" className="adm-btn small" onClick={onHide}>Hide password</button></div>
    </div>
  )
}

/** Role presets plus Custom, and a none / view only / can change choice for every area. */
function AccessPicker({ value, onChange, allowStaff, ceiling, error }: {
  value: Access; onChange: (v: Access) => void; allowStaff: boolean; ceiling?: Perms; error?: string
}) {
  // roles and levels above the person's own access are shown but can't be picked (the server refuses them too)
  const overCeiling = (perms: Perms) => !!ceiling && !withinCeiling({ isOwner: false, perms: ceiling }, perms)
  const levelAllowed = (a: Area, l: Level) => !ceiling || rank(l) <= rank(ceiling[a])
  const id = useId()
  const custom = value.choice === 'custom'
  const showAreas = value.open || custom
  const areas = AREAS.filter((a) => allowStaff || a !== 'staff')

  const choose = (choice: string) => {
    const preset = PRESETS.find((p) => p.key === choice)
    onChange(preset ? { ...value, choice, perms: preset.perms } : { ...value, choice: 'custom', open: true })
  }
  const setLevel = (area: Area, level: Level) => {
    const perms = { ...value.perms, [area]: level }
    onChange({ choice: presetOf(perms), perms, open: true }) // stays open while they work through the list
  }

  return (
    <div className="adm-access">
      <fieldset className="adm-roles" aria-describedby={error ? `${id}-err` : undefined} data-invalid={error ? 'true' : undefined}>
        <legend>Role</legend>
        <div className="adm-roles-list">
          {ROLE_OPTIONS.map((o) => (
            <label key={o.key} className="adm-role">
              <input type="radio" name={`${id}-role`} value={o.key} checked={value.choice === o.key} onChange={() => choose(o.key)}
                disabled={overCeiling(PRESETS.find((p) => p.key === o.key)?.perms ?? normalizePerms({}))} />
              <span><strong>{o.label}</strong><span className="adm-muted">{o.description}</span></span>
            </label>
          ))}
        </div>
        {error && <p className="err" id={`${id}-err`}>{error}</p>}
      </fieldset>

      {!custom && (
        <div>
          <button type="button" className="adm-btn small" aria-expanded={showAreas} aria-controls={`${id}-areas`}
            onClick={() => onChange({ ...value, open: !value.open })}>
            {showAreas ? 'Hide access by area' : 'Fine-tune access by area'}
          </button>
        </div>
      )}

      <div id={`${id}-areas`} className="adm-perms" role="group" aria-labelledby={`${id}-areas-h`} hidden={!showAreas}>
        <p id={`${id}-areas-h`} className="adm-perms-title">Access to each area</p>
        {areas.map((a) => (
          <fieldset key={a} className="adm-perm" aria-describedby={`${id}-${a}-help`}>
            <legend>{AREA_LABELS[a]}</legend>
            <div className="row">
              <p id={`${id}-${a}-help`} className="help">
                {AREA_HELP[a]}{a === 'staff' ? '. Give this only to someone you trust with every login.' : ''}
              </p>
              <div className="opts">
                {LEVELS.map((l) => (
                  <label key={l} className="adm-perm-opt">
                    <input type="radio" name={`${id}-${a}`} value={l} checked={value.perms[a] === l} onChange={() => setLevel(a, l)}
                      disabled={!levelAllowed(a, l)} />
                    {LEVEL_TEXT[l]}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        ))}
        {!allowStaff && <p className="adm-muted">Only the owner can give access to staff accounts.</p>}
        {ceiling && <p className="adm-muted">You can give access up to your own level in each area.</p>}
      </div>
    </div>
  )
}
