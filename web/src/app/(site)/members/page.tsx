import { notFound } from 'next/navigation'

// Hidden until real member accounts exist: the directory listed invented sample members. MemberDirectory
// stays in src/components for then. No metadata: Next marks a 404 noindex by itself.
export default function MembersPage(): never {
  notFound()
}
