import { promises as fs } from 'node:fs'
import { uploadPath } from '@/lib/store/media-store'

export const runtime = 'nodejs'

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/** Serves uploaded images. Names are random and never reused, so they can be cached forever. */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  const full = uploadPath(file)
  if (!full) return new Response('Not found', { status: 404 })
  try {
    const body = await fs.readFile(full)
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': TYPES[file.split('.').pop()!],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
