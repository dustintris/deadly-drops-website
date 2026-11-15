'use client'

import { Check, ListEditor, newId, SaveBar, SectionForm, TextField, useSection } from '@/components/admin/kit'
import type { SiteSettingsT, TickerItemT } from '@/lib/content-schema'

export function AnnouncementsEditor({ settings, ticker, rev }: { settings: SiteSettingsT; ticker: TickerItemT[]; rev: number }) {
  const notice = useSection('settings', settings, rev)
  const tick = useSection('ticker', ticker, rev)
  const n = notice.value.notice
  const setNotice = (patch: Partial<SiteSettingsT['notice']>) => notice.setValue({ ...notice.value, notice: { ...n, ...patch } })


  return (
    <>
      <section className="adm-card" aria-labelledby="bar-h">
        <h2 id="bar-h">Top bar</h2>
        <SectionForm errors={notice.errors}>
          <Check label="Show the top bar" path="notice.enabled" checked={n.enabled} onChange={(v) => setNotice({ enabled: v })} />
          <TextField label="Message" path="notice.text" value={n.text} max={140} onChange={(v) => setNotice({ text: v })}
            hint="Keep it short: one line on a phone is about 60 characters." />
          <TextField label="Link (optional)" path="notice.href" value={n.href ?? ''} placeholder="/tournaments/ or https://…"
            onChange={(v) => setNotice({ href: v || undefined })} />
          <div className="adm-muted">Preview:</div>
          {n.enabled && n.text ? (
            <p style={{ background: 'var(--accent)', color: 'var(--on-accent)', padding: '8px 12px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center' }}>{n.text}</p>
          ) : <p className="adm-muted">The bar is hidden.</p>}
          <SaveBar s={notice} label="Save top bar" />
        </SectionForm>
      </section>

      <section className="adm-card" aria-labelledby="tick-h">
        <h2 id="tick-h">Ticker</h2>
        <p className="adm-muted">Short facts that scroll across the homepage. Visitors can pause it. Up to 20 lines; 4–8 reads best.</p>
        <SectionForm errors={tick.errors}>
          <ListEditor<TickerItemT>
            path=""
            items={tick.value}
            onChange={tick.setValue}
            title={(t) => t.text}
            badge={(t) => (!t.visible ? <span className="adm-badge off">Hidden</span> : null)}
            addLabel="Add ticker line"
            makeNew={() => ({ id: newId(), text: 'New announcement', visible: true })}
            render={(t, i, set) => (
              <>
                <TextField label="Text" path={`${i}.text`} value={t.text} max={80} onChange={(v) => set({ ...t, text: v })} />
                <Check label="Show this line" path={`${i}.visible`} checked={t.visible} onChange={(v) => set({ ...t, visible: v })} />
              </>
            )}
          />
          <SaveBar s={tick} label="Save ticker" />
        </SectionForm>
      </section>
    </>
  )
}
