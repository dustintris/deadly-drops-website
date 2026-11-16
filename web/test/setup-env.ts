import { inject } from 'vitest'

// Every test worker talks to the database started in global-setup.ts.
process.env.DATABASE_URL = inject('databaseUrl')
