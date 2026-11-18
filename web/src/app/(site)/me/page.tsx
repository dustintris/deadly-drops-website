import { notFound } from 'next/navigation'

// Hidden until real member accounts exist: "My play" showed an invented sample account. Dashboard and
// TonightCard stay in src/components for then. No metadata: Next marks a 404 noindex by itself.
export default function MePage(): never {
  notFound()
}
