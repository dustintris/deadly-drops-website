import 'server-only'
import { EventEmitter } from 'node:events'
import { getSql } from '@/db/client'

/**
 * One LISTEN on the `ddp_live` channel per server process, fanned out to every open live stream.
 * Payloads are `{"t": tournamentId, "v": liveVersion}` (sent by src/lib/play/repo.ts on commit).
 * postgres.js keeps the listening connection open and re-listens after a reconnect.
 */

type Bus = { emitter: EventEmitter; ready: Promise<void> }
const g = globalThis as typeof globalThis & { __ddpLive?: Bus }

function bus(): Bus {
  if (!g.__ddpLive) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0) // one listener per open browser tab
    const ready = getSql()
      .listen('ddp_live', (payload) => {
        try {
          const { t, v } = JSON.parse(payload) as { t: number; v: number }
          if (Number.isInteger(t) && Number.isInteger(v)) emitter.emit(`t:${t}`, v)
        } catch {
          /* ignore malformed payloads */
        }
      })
      .then(() => undefined)
      .catch((e) => {
        delete g.__ddpLive // retry on the next subscriber
        throw e
      })
    g.__ddpLive = { emitter, ready }
  }
  return g.__ddpLive
}

/** Call `onChange(liveVersion)` whenever tournament `id` changes. Returns the unsubscribe function. */
export async function subscribe(id: number, onChange: (v: number) => void): Promise<() => void> {
  const b = bus()
  await b.ready
  b.emitter.on(`t:${id}`, onChange)
  return () => b.emitter.off(`t:${id}`, onChange)
}
