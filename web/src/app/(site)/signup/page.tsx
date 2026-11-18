import { notFound } from 'next/navigation'

// Hidden until real member accounts exist: there is no account to create yet. AuthScreen and AuthForm
// stay in src/components for then. No metadata: Next marks a 404 noindex by itself.
export default function SignupPage(): never {
  notFound()
}
