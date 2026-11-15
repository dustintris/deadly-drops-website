import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './store/file-store'

const LOG = path.join(DATA_DIR, 'audit.log')

/** Append-only record of every admin action (JSON lines). */
export async function audit(who: string, action: string, detail = '') {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.appendFile(LOG, JSON.stringify({ at: new Date().toISOString(), who, action, detail: detail.slice(0, 300) }) + '\n')
}

export async function recentAudit(n = 10): Promise<{ at: string; who: string; action: string; detail: string }[]> {
  try {
    const lines = (await fs.readFile(LOG, 'utf8')).trim().split('\n').slice(-n).reverse()
    return lines.map((l) => JSON.parse(l))
  } catch {
    return []
  }
}
