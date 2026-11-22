import { z } from 'zod'
import { EMAIL_ERROR } from '@/lib/forms'

/**
 * What the public Contact form and "Join the list" may send. Client-safe (zod only): the forms check as you
 * type, the server actions check again before anything is stored.
 */

export const TOPICS = ['Joining', 'Tournaments', 'Volunteering', 'Sponsorship', 'Coaching', 'Shop order', 'Something else'] as const
export type Topic = (typeof TOPICS)[number]

export const LIMITS = { name: 100, email: 254, message: 4000 } as const

// characters that change how text looks without being seen: direction overrides, zero-width marks, odd line breaks.
// Gone from everything stored, so a name or address in the admin reads as what it is.
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2028\u2029\u2060-\u2069\ufeff]/g

// one line, no control or invisible characters; trimmed
const line = (max: number, empty: string, long: string) =>
  z.string().transform((s) => s.replace(INVISIBLE, '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()).pipe(z.string().min(1, empty).max(max, long))

// a plain address: no spaces, and none of , ; < > " ( ) [ ] \ that could slip a second recipient into a reply
const ADDRESS = /^[^\s@,;<>"()[\]\\]+@[^\s@,;<>"()[\]\\]+\.[^\s@,;<>"()[\]\\]+$/
const email = z.string().transform((s) => s.replace(INVISIBLE, '').trim().toLowerCase()).pipe(
  z.string().max(LIMITS.email, EMAIL_ERROR).regex(ADDRESS, EMAIL_ERROR),
)

/**
 * A hidden "website" field people never see or fill. Anything in it means a bot: the action reports success
 * and stores nothing, so the bot learns nothing.
 */
const trap = z.string().max(200).optional()

export const ContactInput = z.object({
  name: line(LIMITS.name, 'Enter your name.', 'Use a shorter name.'),
  email,
  topic: z.enum(TOPICS, { errorMap: () => ({ message: 'Pick a topic.' }) }),
  // keep line breaks; drop other control characters
  message: z.string().transform((s) => s.replace(INVISIBLE, '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim())
    .pipe(z.string().min(5, 'Tell us a little about what you need.').max(LIMITS.message, `Keep it under ${LIMITS.message} characters.`)),
  website: trap,
})
export type ContactInputT = z.infer<typeof ContactInput>

export const SignupInput = z.object({ email, website: trap })
export type SignupInputT = z.infer<typeof SignupInput>

/** Field errors from a failed parse, first message per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of error.issues) {
    const k = String(i.path[0] ?? 'form')
    out[k] ??= i.message
  }
  return out
}
