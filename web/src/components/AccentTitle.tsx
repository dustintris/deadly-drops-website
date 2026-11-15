import { accentSegments } from '@/lib/content-schema'

/** Renders an MIS headline; a *starred* word gets the accent colour. */
export function AccentTitle({ title }: { title: string }) {
  return (
    <>
      {accentSegments(title).map((seg, i) => (seg.accent ? <span key={i} className="accent">{seg.text}</span> : <span key={i}>{seg.text}</span>))}
    </>
  )
}
