'use client'

import { ImageField, SaveBar, SectionForm, TextField, useSection } from '@/components/admin/kit'
import { accentSegments, PAGE_KEYS, type PageCopyT, type PageKey } from '@/lib/content-schema'

const NAMES: Record<PageKey, { label: string; path: string; photo: boolean }> = {
  home: { label: 'Homepage', path: '/', photo: true },
  about: { label: 'About us', path: '/about/', photo: true },
  community: { label: 'Community', path: '/community/', photo: true },
  shop: { label: 'Shop', path: '/shop/', photo: false },
  gallery: { label: 'Gallery', path: '/gallery/', photo: false },
  contact: { label: 'Contact us', path: '/contact/', photo: true },
  sponsors: { label: 'Sponsors', path: '/sponsors/', photo: true },
  volunteers: { label: 'Volunteers', path: '/volunteers/', photo: true },
}

export function PagesEditor({ initial }: { initial: Record<PageKey, PageCopyT> }) {
  const s = useSection('pages', initial)
  const set = (key: PageKey, patch: Partial<PageCopyT>) => s.setValue({ ...s.value, [key]: { ...s.value[key], ...patch } })

  return (
    <SectionForm errors={s.errors}>
      {(['home', 'about', 'community', 'shop', 'gallery', 'contact', 'sponsors', 'volunteers'] satisfies readonly PageKey[]).filter((k) => PAGE_KEYS.includes(k)).map((key) => {
        const p = s.value[key]
        const n = NAMES[key]
        return (
          <details key={key} className="adm-item" data-path={key} open={key === 'home' || undefined}>
            <summary style={{ listStyle: 'none' }}>
              <header><span className="title">{n.label}</span>
                <a className="adm-btn small" href={`/admin/preview/?on=1&path=${n.path}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>Preview</a>
              </header>
            </summary>
            <div className="body">
              <TextField label="Small label above the headline (optional)" path={`${key}.eyebrow`} value={p.eyebrow ?? ''} max={40} onChange={(v) => set(key, { eyebrow: v || undefined })} />
              <TextField label="Headline" path={`${key}.title`} value={p.title} max={80} onChange={(v) => set(key, { title: v })}
                hint="Put *stars* around one word to show it in the accent colour, e.g. Everybody's welcome. *Nobody* coasts." />
              <p className="adm-muted" aria-hidden="true" style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: 22, color: 'var(--ink-dark)' }}>
                {accentSegments(p.title).map((seg, i) => <span key={i} style={seg.accent ? { background: 'var(--accent)', padding: '0 4px' } : undefined}>{seg.text}</span>)}
              </p>
              <TextField label="Intro text" path={`${key}.lede`} value={p.lede} max={300} multiline={3} onChange={(v) => set(key, { lede: v })} />
              {n.photo && <ImageField label="Main photo" path={`${key}.heroImage`} value={p.heroImage} onChange={(v) => set(key, { heroImage: v })} />}
              {key === 'home' && <ImageField label="Main photo on phones (optional)" path="home.heroImageMobile" value={p.heroImageMobile} hint="A taller photo works best on phones." onChange={(v) => set(key, { heroImageMobile: v })} />}
            </div>
          </details>
        )
      })}
      <SaveBar s={s} />
    </SectionForm>
  )
}
