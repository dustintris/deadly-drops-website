'use client'

import { ImageField, SaveBar, SectionForm, useFieldError, useSection } from '@/components/admin/kit'
import { contrastRatio, CONTRAST_RULES, type ThemeColourKey, type ThemeT } from '@/lib/content-schema'
import { asset } from '@/lib/utils'
import { BLOSSOM_BRIGHT_THEME, BLOSSOM_THEME, defaultTheme, LEGACY_LIME_THEME, themeLogo, TWILIGHT_THEME } from '@/theme/tokens'

const GROUPS: { title: string; keys: [ThemeColourKey, string][] }[] = [
  { title: 'Brand accent', keys: [['accent', 'Accent (buttons, highlights)'], ['accentSoft', 'Accent, lighter (hovers)'], ['accentDeep', 'Accent, deeper (gradients)'], ['onAccent', 'Text on accent buttons']] },
  { title: 'Dark areas', keys: [['bg', 'Page background'], ['surface', 'Panels'], ['surface2', 'Cards and inputs'], ['ink', 'Text on dark'], ['accentTint', 'Initials tiles']] },
  { title: 'Light areas', keys: [['paper', 'Light section background'], ['paperCard', 'Cards on light sections'], ['inkDark', 'Text on light']] },
  { title: 'Other', keys: [['danger', 'Error text on dark'], ['dangerOnLight', 'Error text on light'], ['logoPlate', 'Behind the logo']] },
]

// Blossom (the default), Blossom deep, Twilight and Lime set every colour (each is a whole design); the others only
// swap the accent family
const PRESETS: { name: string; patch: Partial<ThemeT> }[] = [
  { name: 'Blossom', patch: { ...BLOSSOM_BRIGHT_THEME } },
  { name: 'Blossom deep (navy night)', patch: { ...BLOSSOM_THEME } },
  { name: 'Twilight', patch: { ...TWILIGHT_THEME } },
  { name: 'Lime (original design)', patch: { ...LEGACY_LIME_THEME } },
  { name: 'Club pink', patch: { accent: '#F06AA6', accentSoft: '#F7C6DC', accentDeep: '#C2185B', onAccent: '#111111', accentTint: '#2A0B1C' } },
  { name: 'Court blue', patch: { accent: '#4FC3F7', accentSoft: '#B3E5FC', accentDeep: '#0288D1', onAccent: '#0B1A24', accentTint: '#0E2230' } },
  { name: 'Gold medal', patch: { accent: '#F2C14E', accentSoft: '#FBE3A6', accentDeep: '#C9971C', onAccent: '#111111', accentTint: '#2A2210' } },
]

function ColorRow({ k, label, value, onChange }: { k: string; label: string; value: string; onChange: (v: string) => void }) {
  const err = useFieldError(k)
  const valid = /^#[0-9a-fA-F]{6}$/.test(value)
  return (
    <div className="adm-field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" className="adm-swatch" aria-label={`${label}: colour picker`} value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input id={`f-${k}`} className="adm-input" value={value} maxLength={7} aria-invalid={!!err || !valid} spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim())} style={{ fontFamily: 'var(--font-mono)', maxWidth: 130 }} />
      </div>
      {err ? <p className="err">{err}</p> : !valid ? <p className="err">Use a colour like #C6F24E.</p> : null}
    </div>
  )
}

export function ThemeEditor({ initial }: { initial: ThemeT }) {
  const s = useSection('theme', initial)
  const t = s.value
  const set = (patch: Partial<ThemeT>) => s.setValue({ ...t, ...patch })
  const ok = (h: string) => /^#[0-9a-fA-F]{6}$/.test(h)

  const logo = themeLogo(t)

  return (
    <SectionForm errors={s.errors}>
      <section className="adm-card" aria-labelledby="logo-h">
        <h2 id="logo-h">Club logo</h2>
        <ImageField label="Logo" path="logo" value={t.logo} onChange={(v) => set({ logo: v })}
          hint="Shown in the site header and footer, on the venue screen and printed results, in the admin, and as the browser tab icon and link preview. A square picture works best: the header and footer show it in a circle on the “Behind the logo” colour. Leave it empty to use the club badge." />
      </section>

      <section className="adm-card" aria-labelledby="pre-h">
        <h2 id="pre-h">Quick start</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className="adm-btn" onClick={() => set(p.patch)}>
              <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, background: p.patch.accent }} />{p.name}
            </button>
          ))}
          {/* resets the colours only: the logo stays */}
          <button type="button" className="adm-btn danger" onClick={() => s.setValue({ ...defaultTheme, logo: t.logo })}>Reset colours to default</button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 20 }}>
          {GROUPS.map((g) => (
            <section key={g.title} className="adm-card" aria-label={g.title}>
              <h2>{g.title}</h2>
              <div className="adm-grid">
                {g.keys.map(([k, label]) => <ColorRow key={k} k={k} label={label} value={t[k]} onChange={(v) => set({ [k]: v } as Partial<ThemeT>)} />)}
              </div>
            </section>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 20, position: 'sticky', top: 80 }}>
          <section className="adm-card" aria-labelledby="pv-h">
            <h2 id="pv-h">Preview</h2>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgb(0 0 0 / .1)' }} aria-hidden="true">
              <div style={{ background: t.bg, color: t.ink, padding: 18 }}>
                <img src={asset(logo.src)} alt="" width={44} height={44}
                  style={{ display: 'block', marginBottom: 10, background: t.logoPlate, borderRadius: '50%', padding: 2, objectFit: 'contain' }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: t.accent }}>NEXT UP</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 30, textTransform: 'uppercase', lineHeight: 1 }}>Deadly <span style={{ color: t.accent }}>Drops</span></p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <span style={{ background: t.accent, color: t.onAccent, borderRadius: 100, padding: '8px 14px', fontWeight: 700, fontSize: 12 }}>REGISTER</span>
                  <span style={{ background: t.surface2, color: t.ink, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>$55 entry</span>
                </div>
              </div>
              <div style={{ background: t.paper, color: t.inkDark, padding: 18 }}>
                <div style={{ background: t.paperCard, borderRadius: 10, padding: 14 }}>
                  <strong>How it works</strong>
                  <p style={{ fontSize: 13, opacity: .8 }}>Register online, get matched, play for medals.</p>
                  <p style={{ fontSize: 12, color: t.dangerOnLight, marginTop: 6 }}>Example error message</p>
                </div>
              </div>
            </div>
          </section>

          <section className="adm-card" aria-labelledby="ct-h">
            <h2 id="ct-h">Readability check</h2>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
              {CONTRAST_RULES.map(([fg, bg, label]) => {
                const a = t[fg as ThemeColourKey]
                const b = t[bg as ThemeColourKey]
                const r = ok(a) && ok(b) ? contrastRatio(a, b) : 0
                const pass = r >= 4.5
                return (
                  <li key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                    <span>{label}</span>
                    <span className={`adm-badge ${pass ? 'on' : ''}`} style={pass ? undefined : { background: 'var(--danger-on-light)', color: '#fff' }}>
                      {r ? `${r.toFixed(1)}:1` : '—'} {pass ? 'OK' : 'Too faint'}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="adm-muted">Each needs 4.5:1 or more. Saving is blocked until all pass.</p>
          </section>
        </div>
      </div>
      <SaveBar s={s} />
    </SectionForm>
  )
}
