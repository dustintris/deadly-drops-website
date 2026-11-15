/** Shared form helpers (ui-ux-pro-max: inline validation on blur, focus the first error after a failed submit). */
export const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim())
export const EMAIL_ERROR = 'Enter an email like name@example.com.'

/** Move focus to the first invalid field, in the order given, once React has rendered the errors. */
export function focusFirstError(errors: Record<string, string>, order: [key: string, id: string][]) {
  const hit = order.find(([k]) => errors[k])
  if (hit) requestAnimationFrame(() => document.getElementById(hit[1])?.focus())
}
