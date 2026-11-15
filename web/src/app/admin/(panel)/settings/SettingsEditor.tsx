'use client'

import { LinesField, SaveBar, SectionForm, TextField, useSection } from '@/components/admin/kit'
import type { SiteSettingsT } from '@/lib/content-schema'

/** "(619) 888-1411" → "tel:+16198881411" (US numbers get +1). */
function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return `tel:+${digits.length === 10 ? '1' + digits : digits}`
}

export function SettingsEditor({ initial }: { initial: SiteSettingsT }) {
  const s = useSection('settings', initial)
  const v = s.value
  const set = (patch: Partial<SiteSettingsT>) => s.setValue({ ...v, ...patch })

  return (
    <SectionForm errors={s.errors}>
      <section className="adm-card" aria-labelledby="c-h">
        <h2 id="c-h">Club and contact</h2>
        <div className="adm-grid">
          <TextField label="Club name" path="name" value={v.name} max={60} onChange={(x) => set({ name: x })} />
          <TextField label="Short name" path="shortName" value={v.shortName} max={30} hint="Used in the header." onChange={(x) => set({ shortName: x })} />
          <TextField label="Email" path="email" type="email" value={v.email} onChange={(x) => set({ email: x })} />
          <TextField label="Phone" path="phone" type="tel" value={v.phone} onChange={(x) => set({ phone: x, phoneHref: telHref(x) })} hint="Shown as typed; tapping it calls the number. Leave empty to keep it off the site." />
          <TextField label="City" path="city" value={v.city} onChange={(x) => set({ city: x })} />
          <TextField label="ZIP code" path="postcode" value={v.postcode} onChange={(x) => set({ postcode: x })} />
        </div>
        <TextField label="Tagline" path="tagline" value={v.tagline} max={120} onChange={(x) => set({ tagline: x })} />
        <TextField label="About the club" path="about" value={v.about} max={800} multiline={5} onChange={(x) => set({ about: x })} />
        <LinesField label="Highlights" path="highlights" value={v.highlights} max={6} onChange={(x) => set({ highlights: x })} hint="Up to 6 short facts, one per line (shown as tags on About)." />
      </section>

      <section className="adm-card" aria-labelledby="s-h">
        <h2 id="s-h">How it works (3 steps on the homepage)</h2>
        {v.howItWorks.map((step, i) => (
          <div key={i} className="adm-grid">
            <TextField label={`Step ${i + 1} title`} path={`howItWorks.${i}.title`} value={step.title} max={40}
              onChange={(x) => set({ howItWorks: v.howItWorks.map((st, k) => (k === i ? { ...st, title: x } : st)) })} />
            <TextField label={`Step ${i + 1} text`} path={`howItWorks.${i}.body`} value={step.body} max={240} multiline={2}
              onChange={(x) => set({ howItWorks: v.howItWorks.map((st, k) => (k === i ? { ...st, body: x } : st)) })} />
          </div>
        ))}
      </section>

      <section className="adm-card" aria-labelledby="f-h">
        <h2 id="f-h">Community favourites (About page)</h2>
        {v.favorites.map((f, i) => (
          <div key={i} className="adm-grid">
            <TextField label={`Favourite ${i + 1} title`} path={`favorites.${i}.title`} value={f.title} max={40}
              onChange={(x) => set({ favorites: v.favorites.map((it, k) => (k === i ? { ...it, title: x } : it)) })} />
            <TextField label={`Favourite ${i + 1} text`} path={`favorites.${i}.body`} value={f.body} max={240} multiline={2}
              onChange={(x) => set({ favorites: v.favorites.map((it, k) => (k === i ? { ...it, body: x } : it)) })} />
          </div>
        ))}
      </section>

      <section className="adm-card" aria-labelledby="ab-h">
        <h2 id="ab-h">About page points</h2>
        {(v.aboutPoints ?? []).map((pt, i) => (
          <div key={i} className="adm-grid">
            <TextField label={`Point ${i + 1} title`} path={`aboutPoints.${i}.title`} value={pt.title} max={40}
              onChange={(x) => set({ aboutPoints: v.aboutPoints.map((it, k) => (k === i ? { ...it, title: x } : it)) })} />
            <TextField label={`Point ${i + 1} text`} path={`aboutPoints.${i}.body`} value={pt.body} max={300} multiline={3}
              onChange={(x) => set({ aboutPoints: v.aboutPoints.map((it, k) => (k === i ? { ...it, body: x } : it)) })} />
          </div>
        ))}
      </section>

      <section className="adm-card" aria-labelledby="so-h">
        <h2 id="so-h">Social media</h2>
        <div className="adm-grid">
          {(['instagram', 'facebook', 'youtube', 'tiktok'] as const).map((k) => (
            <TextField key={k} label={k[0].toUpperCase() + k.slice(1)} path={`social.${k}`} value={v.social?.[k] ?? ''} placeholder="https://…"
              onChange={(x) => set({ social: { ...v.social, [k]: x || undefined } })} />
          ))}
        </div>
      </section>

      <section className="adm-card" aria-labelledby="sh-h">
        <h2 id="sh-h">Shop</h2>
        <div className="adm-grid">
          <div className="adm-field">
            <label htmlFor="f-shop.memberDiscount">Member discount (%)</label>
            <input id="f-shop.memberDiscount" className="adm-input" type="number" min={0} max={50} step={1}
              value={Math.round(v.shop.memberDiscount * 100)}
              onChange={(e) => set({ shop: { ...v.shop, memberDiscount: Math.min(50, Math.max(0, Number(e.target.value) || 0)) / 100 } })} />
            <p className="hint">Taken off at checkout for signed-in members. 0 turns it off.</p>
          </div>
          <TextField label="Pickup note" path="shop.pickupNote" value={v.shop.pickupNote} max={80} onChange={(x) => set({ shop: { ...v.shop, pickupNote: x } })} />
        </div>
      </section>

      <SaveBar s={s} />
    </SectionForm>
  )
}
