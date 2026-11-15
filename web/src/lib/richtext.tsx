/**
 * Safe renderer for the small markdown subset used in community post bodies.
 *
 *   Paragraphs (separated by a blank line)   ## Heading   ### Smaller heading
 *   - bullet list items                      **bold**     *italic*
 *   [link text](https://…)  [email](mailto:…)  [page](/tournaments/)
 *
 * Everything is built as React elements, so text is always escaped. Links are only made
 * for https:, mailto: and internal "/" paths; anything else is shown as plain text.
 */
import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

type Block =
  | { type: 'p'; text: string }
  | { type: 'h2' | 'h3'; text: string }
  | { type: 'ul'; items: string[] }

const SAFE_HTTPS = /^https:\/\/[^\s"<>]+$/i
const SAFE_MAILTO = /^mailto:[^\s"<>/]+@[^\s"<>]+$/i
const SAFE_INTERNAL = /^\/(?![/\\])[^\s"<>]*$/

export type SafeHref = { href: string; external: boolean; internal: boolean }

/** Returns the link target if it is allowed, otherwise null. */
export function safeHref(raw: string): SafeHref | null {
  const url = raw.trim()
  if (SAFE_HTTPS.test(url)) return { href: url, external: true, internal: false }
  if (SAFE_MAILTO.test(url)) return { href: url, external: false, internal: false }
  if (SAFE_INTERNAL.test(url)) return { href: url, external: false, internal: true }
  return null
}

/** Splits the body into headings, lists and paragraphs. */
export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] | null = null

  const flushPara = () => { if (para.length) blocks.push({ type: 'p', text: para.join(' ') }); para = [] }
  const flushList = () => { if (list?.length) blocks.push({ type: 'ul', items: list }); list = null }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushPara(); flushList(); continue }
    const h = /^(#{2,3})\s+(.+)$/.exec(line)
    if (h) {
      flushPara(); flushList()
      blocks.push({ type: h[1].length === 2 ? 'h2' : 'h3', text: h[2].replace(/\s+#+$/, '') })
      continue
    }
    const li = /^[-*]\s+(.+)$/.exec(line)
    if (li && !/^\*\*/.test(line)) {
      flushPara()
      ;(list ??= []).push(li[1])
      continue
    }
    if (list) {
      // a wrapped line straight after a bullet continues that bullet
      list[list.length - 1] += ' ' + line
      continue
    }
    para.push(line)
  }
  flushPara(); flushList()
  return blocks
}

// link | bold | italic (order matters: bold before italic)
const INLINE = /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\*\*([^\n]+?)\*\*(?!\*)|\*([^*\n]+?)\*/g

/** Renders inline formatting inside one block of text. */
export function renderInline(text: string, keyPrefix = 'i', depth = 0): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  const re = new RegExp(INLINE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyPrefix}-${n++}`
    const inner = (s: string) => (depth < 2 ? renderInline(s, key, depth + 1) : [s])
    if (m[1] !== undefined) {
      const target = safeHref(m[2])
      if (!target) out.push(<Fragment key={key}>{inner(m[1])}</Fragment>)
      else if (target.internal) out.push(<Link key={key} href={target.href}>{inner(m[1])}</Link>)
      else if (target.external) out.push(<a key={key} href={target.href} target="_blank" rel="noopener noreferrer">{inner(m[1])}<span className="sr"> (opens in a new tab)</span></a>)
      else out.push(<a key={key} href={target.href}>{inner(m[1])}</a>)
    } else if (m[3] !== undefined) {
      out.push(<strong key={key}>{inner(m[3])}</strong>)
    } else if (m[4] !== undefined) {
      out.push(<em key={key}>{inner(m[4])}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Renders a whole post body. Headings start at h2 because the page title is the h1. */
export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source)
  if (!blocks.length) return null
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const k = `b${i}`
        if (b.type === 'h2') return <h2 key={k}>{renderInline(b.text, k)}</h2>
        if (b.type === 'h3') return <h3 key={k}>{renderInline(b.text, k)}</h3>
        if (b.type === 'ul') return <ul key={k}>{b.items.map((it, j) => <li key={j}>{renderInline(it, `${k}-${j}`)}</li>)}</ul>
        return <p key={k}>{renderInline(b.text, k)}</p>
      })}
    </div>
  )
}

/** Plain text version of a body (formatting removed), e.g. for descriptions. */
export function plainText(source: string) {
  return parseBlocks(source)
    .map((b) => (b.type === 'ul' ? b.items.join(' ') : b.text))
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
}
