import { notFound } from 'next/navigation'

// Hidden until real member accounts exist: profiles were built from invented sample members. Dashboard
// stays in src/components for then. No metadata: Next marks a 404 noindex by itself.
export default function MemberPage(): never {
  notFound()
}
