'use client'

/**
 * Change your own password. The owner's password lives on the server (npm run admin:setup),
 * so the owner gets an explanation instead of the form. The server re-checks everything.
 */
import { useId, useRef, useState } from 'react'
import { changeOwnPassword, type StaffResult } from '@/app/admin/staff-actions'

type Errors = Record<string, string>
type Note = { ok: boolean; text: string }

const MIN_PASSWORD = 12

export function AccountForm({ isOwner, email }: { isOwner: boolean; email?: string }) {
  return (
    <section className="adm-card" aria-labelledby="acct-pw-h">
      <h2 id="acct-pw-h">Change your password</h2>
      {isOwner ? (
        <p className="adm-locknote">
          The owner password is set on the server, not here: run <code>npm run admin:setup</code> on the server and restart the
          site. That also signs the owner out on every device.
        </p>
      ) : (
        <PasswordForm email={email} />
      )}
    </section>
  )
}

function PasswordForm({ email }: { email?: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)
  const type = show ? 'text' : 'password'

  const edit = (key: string, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value)
    setErrors((x) => {
      if (!(key in x)) return x
      const { [key]: _, ...rest } = x
      return rest
    })
  }

  const fail = (message: string, errs: Errors) => {
    setNote({ ok: false, text: message })
    setErrors(errs)
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const local: Errors = {}
    if (!current) local.current = 'Enter your current password.'
    if (next.length < MIN_PASSWORD) local.next = `Use at least ${MIN_PASSWORD} characters.`
    else if (next === current) local.next = 'Choose a password different from the current one.'
    if (!local.next && confirm !== next) local.confirm = 'This doesn’t match the new password. Type it again.'
    if (Object.keys(local).length) return fail('Fix the highlighted fields.', local)

    setBusy(true)
    setNote(null)
    let res: StaffResult
    try {
      res = await changeOwnPassword(current, next)
    } catch {
      res = { ok: false, message: 'Could not reach the server. Check your connection, or sign in again, then try again.' }
    }
    setBusy(false)
    if (!res.ok) return fail(res.message, res.errors ?? {})
    setNote({ ok: true, text: res.message })
    setErrors({})
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="adm-staff-form">
      {/* lets password managers file the new password under the right login */}
      {email && <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />}
      <Field label="Current password" error={errors.current}>
        {(p) => <input {...p} className="adm-input" type={type} value={current} autoComplete="current-password" required onChange={edit('current', setCurrent)} />}
      </Field>
      <Field label="New password" error={errors.next} hint={`At least ${MIN_PASSWORD} characters. A few unrelated words make a strong password that is easy to remember.`}>
        {(p) => <input {...p} className="adm-input" type={type} value={next} maxLength={200} autoComplete="new-password" required onChange={edit('next', setNext)} />}
      </Field>
      <Field label="Type the new password again" error={errors.confirm}>
        {(p) => <input {...p} className="adm-input" type={type} value={confirm} maxLength={200} autoComplete="new-password" required onChange={edit('confirm', setConfirm)} />}
      </Field>
      <label className="adm-check">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
      </label>
      <p className="adm-muted">Your other devices are signed out when you change it; this one stays signed in.</p>
      <div className="adm-actions">
        <button type="submit" className="adm-btn primary" aria-disabled={busy}>{busy ? 'Changing password…' : 'Change password'}</button>
        <p role="status" className={`adm-note ${note ? (note.ok ? 'good' : 'bad') : ''}`}>{note?.text}</p>
      </div>
    </form>
  )
}

type FieldProps = { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }

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
