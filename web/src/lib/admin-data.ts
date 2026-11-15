import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { LibraryImage } from '@/components/admin/kit'
import { requireAdmin } from './auth/session'
import { readDraft } from './store/file-store'

/** Everything an admin screen needs: the draft and the image library (uploads + bundled photos). */
export async function getAdminData() {
  await requireAdmin()
  const draft = await readDraft()
  const bundled: LibraryImage[] = []
  for (const dir of ['club', 'stand-in']) {
    try {
      const files = await fs.readdir(path.join(process.cwd(), 'public', 'images', dir === 'club' ? 'club' : 'stand-in'))
      for (const f of files.filter((x) => /^[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(x)).sort()) {
        bundled.push({ src: `/images/${dir}/${f}`, alt: '', label: f.replace(/\.[^.]+$/, '').replace(/-/g, ' '), stand: dir === 'stand-in' })
      }
    } catch { /* folder may not exist */ }
  }
  bundled.push({ src: '/logo.png', alt: 'Deadly Drops Pickleball crest', label: 'club crest' })
  const uploads: LibraryImage[] = draft.media.map((m) => ({ src: `/media/${m.file}`, alt: m.alt, label: m.alt || `${m.width}×${m.height} upload` }))
  return { draft, library: [...uploads, ...bundled] }
}
