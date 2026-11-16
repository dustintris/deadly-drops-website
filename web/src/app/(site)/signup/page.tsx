import type { Metadata } from 'next'
import { AuthScreen } from '@/components/AuthScreen'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Create account', 'Create a Deadly Drops Pickleball account.', '/signup/', { noindex: true })

export default function SignupPage() {
  return <AuthScreen initial="signup" />
}
