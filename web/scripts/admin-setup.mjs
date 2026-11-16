#!/usr/bin/env node
/*
 * Creates (or updates) web/.env.local with the owner login for the MIS.
 *   npm run admin:setup
 * Or non-interactively: ADMIN_SETUP_EMAIL=... ADMIN_SETUP_PASSWORD=... npm run admin:setup
 */
import { randomBytes, scrypt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

async function prompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const email = await rl.question('Owner email: ')
  const password = await rl.question('Password (at least 12 characters): ')
  rl.close()
  return { email, password }
}

const { email, password } = process.env.ADMIN_SETUP_EMAIL
  ? { email: process.env.ADMIN_SETUP_EMAIL, password: process.env.ADMIN_SETUP_PASSWORD ?? '' }
  : await prompt()

if (!/^\S+@\S+\.\S+$/.test(email.trim())) { console.error('That email does not look right.'); process.exit(1) }
if (password.length < 12) { console.error('Use a password of at least 12 characters.'); process.exit(1) }

const salt = randomBytes(16)
const hash = await new Promise((res, rej) =>
  scrypt(password, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))))

const values = {
  ADMIN_EMAIL: email.trim(),
  ADMIN_PASSWORD_HASH: `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`,
}
const file = new URL('../.env.local', import.meta.url)
// SESSION_SECRET is dropped too: sign-in sessions now live in the database and need no secret
const kept = existsSync(file)
  ? readFileSync(file, 'utf8').split('\n').filter((l) => l && !/^(ADMIN_EMAIL|ADMIN_PASSWORD_HASH|SESSION_SECRET)=/.test(l))
  : []
// Next's env loader expands $VAR, so escape the $ in the hash
const lines = Object.entries(values).map(([k, v]) => `${k}=${v.replace(/\$/g, '\\$')}`)
writeFileSync(file, [...kept, ...lines].join('\n') + '\n', { mode: 0o600 })
console.log('Saved web/.env.local. Start the site and log in at /admin/.')
