import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { tournaments } from '@/db/schema'
import { getSession } from '@/lib/auth/session'
import { subscribe } from '@/lib/live/bus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /live/<tournamentId>/ — Server-Sent Events. Sends `{"v": liveVersion}` now and whenever a
 * score, team or schedule changes; screens then re-fetch their own view. Carries no scores or names,
 * so it's public for visible tournaments; hidden ones only stream to signed-in staff.
 */
export async function GET(req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const id = Number((await params).tournamentId)
  if (!Number.isInteger(id) || id <= 0) return new Response('Not found', { status: 404 })
  const [t] = await getDb().select({ visible: tournaments.visible }).from(tournaments).where(eq(tournaments.id, id)).limit(1)
  if (!t || (!t.visible && !(await getSession()))) return new Response('Not found', { status: 404 })

  const enc = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let unsubscribe = () => {}
      let ping: ReturnType<typeof setInterval> | undefined
      const send = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(enc.encode(chunk))
        } catch {
          cleanup()
        }
      }
      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(ping)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      req.signal.addEventListener('abort', cleanup) // registered before any await, so an early disconnect is caught
      // listen first, then read the current version: a change in between is never missed
      unsubscribe = await subscribe(id, (v) => send(`data: ${JSON.stringify({ v })}\n\n`))
      if (req.signal.aborted) return cleanup()
      const [now] = await getDb().select({ v: tournaments.liveVersion }).from(tournaments).where(eq(tournaments.id, id)).limit(1)
      // browsers reconnect after 3 s if the connection drops
      send(`retry: 3000\ndata: ${JSON.stringify({ v: now?.v ?? 0 })}\n\n`)
      // a comment every 25 s keeps phone hotspots and proxies from closing an idle connection
      ping = setInterval(() => send(': ping\n\n'), 25_000)
      if (closed) clearInterval(ping)
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
