import type { Metadata } from 'next'
import { AuthScreen } from '@/components/AuthScreen'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('Log in', 'Log in to your Deadly Drops Pickleball account.', '/login/', { noindex: true })

export default function LoginPage() {
  return <AuthScreen initial="login" />
}
