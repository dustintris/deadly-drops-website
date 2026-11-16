/**
 * `npm test`: run Vitest once.
 *
 * On Windows, a lowercase drive letter in the working directory (c:\ — what the
 * VS Code terminal gives) makes Vitest load its runner twice under two path
 * spellings ("failed to find the runner"). Start Vitest in a child process whose
 * working directory and entry path both use an uppercase drive letter.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const upper = (p) => p.replace(/^[a-z](?=:)/, (d) => d.toUpperCase())
const cwd = upper(process.cwd())
const cli = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs')

const { status } = spawnSync(process.execPath, [cli, 'run', ...process.argv.slice(2)], { cwd, stdio: 'inherit' })
process.exit(status ?? 1)
