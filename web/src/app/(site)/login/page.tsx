import { notFound } from 'next/navigation'

// Hidden until real member accounts exist: there is nothing to log in to yet. AuthScreen and AuthForm
// stay in src/components for then. No metadata: Next marks a 404 noindex by itself.
export default function LoginPage(): never {
  notFound()
}
