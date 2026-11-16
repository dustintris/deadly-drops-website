import path from 'node:path'

/**
 * Runtime data folder on the persistent volume (uploaded images). Website
 * content and the audit log live in PostgreSQL; only files stay on disk.
 */
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.CONTENT_DIR || path.join(process.cwd(), 'data'))
