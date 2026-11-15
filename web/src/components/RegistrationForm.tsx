'use client'

import { useState } from 'react'
import type { ClubEvent } from '@/lib/types'
import { EMAIL_ERROR, focusFirstError, isEmail } from '@/lib/forms'
import { money } from '@/lib/utils'
import styles from './tournaments.module.css'

const SIZES = ['S', 'M', 'L', 'XL', '2XL']
const DIVISIONS = ['2.5', '3.0', '3.5', '4.0', '4.5+']
const TYPES = ['Mixed doubles', "Men's doubles", "Women's doubles"]

/**
 * Three-step tournament entry. Steps 1–2 work fully in the preview; step 3
 * (payment) is a stub. Production: POST the entry to the registration API,
 * take payment, then email a confirmation.
 */
export function RegistrationForm({ event }: { event: ClubEvent }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', type: TYPES[0], division: '3.5', partner: '', size: 'M', meal: true })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const price = form.meal && event.entryFeeWithMeal ? event.entryFeeWithMeal : event.entryFee
  const set = (k: keyof typeof form, v: string | boolean) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })) }

  const next = () => {
    if (step === 1) {
      const e: Record<string, string> = {}
      if (!form.name.trim()) e.name = 'Enter your full name.'
      if (!isEmail(form.email)) e.email = `${EMAIL_ERROR} Your confirmation goes here.`
      setErrors(e)
      focusFirstError(e, [['name', 'reg-name'], ['email', 'reg-email']])
      if (Object.keys(e).length) return
    }
    setStep((s) => s + 1)
  }

  return (
    <div className={styles.reg}>
      <div className={styles.regHead}>
        <p className="eyebrow">Registration · step {step} of 3</p>
        <div className={styles.progress} aria-hidden="true">
          {[1, 2, 3].map((n) => <span key={n} data-on={n <= step} />)}
        </div>
      </div>
      <h2 className="display d-m">{step === 3 ? "You're in" : `${event.name}: your entry`}</h2>

      {step === 1 && (
        <div className={styles.regGrid}>
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input id="reg-name" required aria-required="true" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby="reg-name-err" autoComplete="name" />
            {errors.name && <p id="reg-name-err" className="error">{errors.name}</p>}
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input id="reg-email" required aria-required="true" type="email" inputMode="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} onBlur={() => form.email && !isEmail(form.email) && setErrors((x) => ({ ...x, email: `${EMAIL_ERROR} Your confirmation goes here.` }))} aria-invalid={!!errors.email} aria-describedby="reg-email-err" autoComplete="email" placeholder="you@email.com" />
            {errors.email && <p id="reg-email-err" className="error">{errors.email}</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.regGrid}>
          <div className="field">
            <label htmlFor="reg-type">Event type</label>
            <select id="reg-type" className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="reg-div">Division</label>
            <select id="reg-div" className="input" value={form.division} onChange={(e) => set('division', e.target.value)}>
              {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="reg-partner">Partner</label>
            <input id="reg-partner" className="input" value={form.partner} onChange={(e) => set('partner', e.target.value)} placeholder="Name, or leave blank and we'll find you one" />
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend className="label" style={{ marginBottom: 8 }}>Shirt size</legend>
            <div className={styles.sizes}>
              {SIZES.map((s) => (
                <button type="button" key={s} aria-pressed={form.size === s} onClick={() => set('size', s)}>{s}</button>
              ))}
            </div>
          </fieldset>
          {event.entryFeeWithMeal && (
            <label className={styles.meal}>
              <input type="checkbox" checked={form.meal} onChange={(e) => set('meal', e.target.checked)} />
              Add a fresh tournament meal (+{money(event.entryFeeWithMeal - event.entryFee)})
            </label>
          )}
        </div>
      )}

      {step === 3 && (
        <div className={styles.done} role="status">
          <p>
            Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''}. {form.type}, division {form.division}, shirt {form.size}
            {form.meal ? ', meal included' : ''}.
          </p>
          <p className="muted small">
            Preview only: nothing was charged or sent. On the live site you pay here and your confirmation is emailed
            to {form.email || 'you'}.
          </p>
        </div>
      )}

      <div className={styles.regFoot}>
        <p>
          <strong>{money(price, true)}</strong>
          <span className="muted small">{form.meal && event.entryFeeWithMeal ? 'Includes meal + tournament shirt' : 'Includes tournament shirt'}</span>
        </p>
        <div className={styles.regBtns}>
          {step > 1 && step < 3 && <button className="btn btn-ghost on-light" onClick={() => setStep((s) => s - 1)}>Back</button>}
          {step === 1 && <button className="btn btn-accent" onClick={next}>Continue</button>}
          {step === 2 && <button className="btn btn-accent" onClick={next}>Continue to payment</button>}
          {step === 3 && <button className="btn btn-dark" onClick={() => { setStep(1); setForm((f) => ({ ...f, partner: '' })) }}>Register another player</button>}
        </div>
      </div>
    </div>
  )
}
