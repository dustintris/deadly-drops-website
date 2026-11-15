'use client'

import { useState } from 'react'
import { Check, ImageField, ImagePicker, LinesField, ListEditor, newId, SaveBar, SectionForm, Select, slugify, TextField, useFieldError, useSection } from '@/components/admin/kit'
import c from '@/components/community.module.css'
import type { CommunityPostT } from '@/lib/content-schema'
import { RichText } from '@/lib/richtext'

type Post = CommunityPostT
type Img = Post['photos'][number]

const KINDS: { value: Post['kind']; label: string }[] = [
  { value: 'news', label: 'News' },
  { value: 'article', label: 'Article' },
  { value: 'photo-story', label: 'Photo story' },
]
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<Post['kind'], string>
const STATUSES: { value: Post['status']; label: string }[] = [
  { value: 'draft', label: 'Draft (not on the site)' },
  { value: 'published', label: 'Published' },
]

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CommunityEditor({ initial, rev }: { initial: Post[]; rev: number }) {
  const s = useSection('posts', initial, rev)
  const list = s.value
  const counts = {
    published: list.filter((p) => p.status === 'published').length,
    draft: list.filter((p) => p.status === 'draft').length,
  }

  const freeSlug = () => {
    const taken = new Set(list.map((p) => p.slug))
    let n = list.length + 1
    while (taken.has(`post-${n}`)) n++
    return `post-${n}`
  }

  return (
    <SectionForm errors={s.errors}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <p className="adm-muted" style={{ marginRight: 'auto' }} role="status">
          {list.length ? `${list.length} post${list.length === 1 ? '' : 's'}: ${counts.published} published, ${counts.draft} draft.` : 'No posts yet. Add the first one below.'}
        </p>
        {list.length > 1 && (
          <button type="button" className="adm-btn small" onClick={() => s.setValue([...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)))}>
            Sort newest first
          </button>
        )}
      </div>
      <ListEditor<Post>
        path=""
        items={list}
        onChange={s.setValue}
        title={(p) => p.title}
        thumb={(p) => p.cover?.src ?? p.photos[0]?.src}
        startOpen={list.length === 1}
        badge={(p) => (
          <>
            <span className="adm-badge">{KIND_LABEL[p.kind]}</span>
            <span className={`adm-badge ${p.status === 'published' ? 'on' : 'off'}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span>
            {p.featured && <span className="adm-badge on">Featured</span>}
          </>
        )}
        addLabel="Add post"
        makeNew={() => ({
          id: newId(), slug: freeSlug(), kind: 'news', title: 'New post',
          excerpt: 'Write a sentence or two that sums up this post.', body: '',
          cover: undefined, photos: [], author: 'Deadly Drops', publishedAt: today(), tags: [], featured: false, status: 'draft',
        })}
        render={(post, i, set) => <PostFields post={post} i={i} set={set} setFeatured={(v) => s.setValue(list.map((x, k) => ({ ...x, featured: k === i ? v : v ? false : x.featured })))} />}
      />
      <SaveBar s={s} />
    </SectionForm>
  )
}

function PostFields({ post, i, set, setFeatured }: { post: Post; i: number; set: (p: Post) => void; setFeatured: (v: boolean) => void }) {
  const [preview, setPreview] = useState(false)
  const p = (k: string) => `${i}.${k}`
  const needsCover = post.kind !== 'news'
  const dateErr = useFieldError(p('publishedAt'))
  const autoSlug = post.slug.startsWith('post-') || post.slug === slugify(post.title)

  return (
    <>
      <div className="adm-grid">
        <TextField label="Title" path={p('title')} value={post.title} max={100}
          onChange={(v) => set({ ...post, title: v, slug: autoSlug && slugify(v) ? slugify(v) : post.slug })} />
        <TextField label="Web address" path={p('slug')} value={post.slug} hint={`Shown as /community/${post.slug || '…'}/ — lowercase words with dashes.`}
          onChange={(v) => set({ ...post, slug: slugify(v) })} />
      </div>
      <div className="adm-grid">
        <Select<Post['kind']> label="Type of post" path={p('kind')} value={post.kind} options={KINDS}
          hint="News is a short update. Articles and photo stories show as cards with a cover photo."
          onChange={(v) => set({ ...post, kind: v ?? 'news' })} />
        <Select<Post['status']> label="Status" path={p('status')} value={post.status} options={STATUSES}
          hint="Drafts stay hidden from the public site."
          onChange={(v) => set({ ...post, status: v ?? 'draft' })} />
      </div>
      <TextField label="Summary" path={p('excerpt')} value={post.excerpt} max={240} multiline={2}
        hint="One or two sentences (20 to 240 characters). Shown on cards, in the news list and in search results."
        onChange={(v) => set({ ...post, excerpt: v })} />

      <div className="adm-field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="lbl" style={{ fontWeight: 600 }}>Body</span>
          <button type="button" className="adm-btn small" aria-pressed={preview} aria-controls={`body-${i}`} onClick={() => setPreview((v) => !v)}>
            {preview ? 'Back to editing' : 'Preview'}
          </button>
        </div>
        <div id={`body-${i}`}>
          {preview ? (
            <div className={c.adminPreview} aria-label="Body preview" role="region">
              {post.body.trim() ? <RichText source={post.body} /> : <p className="adm-muted">Nothing written yet.</p>}
            </div>
          ) : (
            <TextField label="Body text" path={p('body')} value={post.body} max={20000} multiline={14}
              hint="Leave a blank line between paragraphs. Formatting: ## Heading, ### Smaller heading, - list item, **bold**, *italic*, [link text](https://…)."
              onChange={(v) => set({ ...post, body: v })} />
          )}
        </div>
      </div>

      <ImageField label={needsCover ? 'Cover image (required)' : 'Cover image (optional)'} path={p('cover')} value={post.cover}
        hint={needsCover ? 'Articles and photo stories need a cover image. Describe it for screen readers.' : 'Optional for news. Describe it for screen readers.'}
        onChange={(v) => set({ ...post, cover: v })} />

      <PhotosField path={p('photos')} value={post.photos} onChange={(v) => set({ ...post, photos: v })} />

      <div className="adm-grid">
        <TextField label="Author" path={p('author')} value={post.author} max={60} onChange={(v) => set({ ...post, author: v })} />
        <div className="adm-field">
          <label htmlFor={`f-${p('publishedAt')}`}>Publish date</label>
          <input id={`f-${p('publishedAt')}`} type="date" className="adm-input" value={post.publishedAt} aria-invalid={!!dateErr}
            onChange={(e) => set({ ...post, publishedAt: e.target.value })} />
          {dateErr ? <p className="err">{dateErr}</p> : <p className="hint">Posts are listed newest first by this date.</p>}
        </div>
      </div>
      <LinesField label="Tags" path={p('tags')} value={post.tags} max={6} hint="Up to 6, one per line, e.g. Socials."
        onChange={(v) => set({ ...post, tags: v })} />
      <Check label="Feature at the top of the Community page" path={p('featured')} checked={post.featured}
        hint="Only one post can be featured. Featuring this one un-features the others."
        onChange={setFeatured} />
    </>
  )
}

/** A list of photos: add from the library, describe, reorder, remove. */
function PhotosField({ path, value, onChange }: { path: string; value: Img[]; onChange: (v: Img[]) => void }) {
  const [picking, setPicking] = useState(false)
  const err = useFieldError(path)
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <fieldset className="adm-card" style={{ border: '1px solid rgb(var(--ink-dark-rgb) / .1)' }} data-path={path}>
      <legend className="lbl" style={{ fontWeight: 700, padding: '0 6px' }}>Photos ({value.length})</legend>
      <p className="adm-muted">Shown as a photo grid under the post. Add a short description to each one for screen readers.</p>
      {value.length > 0 && (
        <ul className={c.adminPhotos}>
          {value.map((img, k) => (
            <li key={`${img.src}-${k}`}>
              <img src={img.src} alt="" />
              <input className="adm-input" id={`f-${path}.${k}.alt`} aria-label={`Photo ${k + 1}: description for screen readers`} placeholder="Describe the photo"
                maxLength={160} value={img.alt} onChange={(e) => onChange(value.map((x, n) => (n === k ? { ...x, alt: e.target.value } : x)))} />
              <button type="button" className="adm-btn icon small" onClick={() => move(k, -1)} disabled={k === 0} aria-label={`Move photo ${k + 1} up`}>↑</button>
              <button type="button" className="adm-btn icon small" onClick={() => move(k, 1)} disabled={k === value.length - 1} aria-label={`Move photo ${k + 1} down`}>↓</button>
              <button type="button" className="adm-btn icon small danger" onClick={() => onChange(value.filter((_, n) => n !== k))} aria-label={`Remove photo ${k + 1}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="adm-btn" onClick={() => setPicking(true)} disabled={value.length >= 40}>+ Add photo</button>
      {value.length >= 40 && <p className="hint">A post can have up to 40 photos.</p>}
      {err && <p className="err">{err}</p>}
      {picking && (
        <ImagePicker onClose={() => setPicking(false)} onPick={(img) => { onChange([...value, { src: img.src, alt: img.alt }]); setPicking(false) }} />
      )}
    </fieldset>
  )
}
