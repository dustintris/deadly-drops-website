import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './store/file-store'

const LOG = path.join(DATA_DIR, 'audit.log')

/** Append-only record of every admin action (JSON lines). */
export async function audit(who: string, action: string, detail = '') {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
  // keep the log bounded: past 5 MB it rolls over to audit.log.1
  try {
    if ((await fs.stat(LOG)).size > 5 * 1024 * 1024) await fs.rename(LOG, `${LOG}.1`)
  } catch { /* no log yet */ }
  const entry = { at: new Date().toISOString(), who: who.slice(0, 254), action: action.slice(0, 40), detail: detail.slice(0, 300) }
  await fs.appendFile(LOG, JSON.stringify(entry) + '\n', { mode: 0o600 })
}

export async function recentAudit(n = 10): Promise<{ at: string; who: string; action: string; detail: string }[]> {
  try {
    // read only the end of the file
    const handle = await fs.open(LOG, 'r')
    try {
      const { size } = await handle.stat()
      const len = Math.min(size, 64 * 1024)
      const buf = Buffer.alloc(len)
      await handle.read(buf, 0, len, size - len)
      let lines = buf.toString('utf8').split('\n').filter(Boolean)
      if (len < size) lines = lines.slice(1) // the first line may be cut in half
      lines = lines.slice(-n).reverse()
      return lines.flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
    } finally {
      await handle.close()
    }
  } catch {
    return []
  }
}
