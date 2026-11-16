import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Dashboard } from '@/components/Dashboard'
import { getMembers, getProfile } from '@/lib/data'
import { pageMeta } from '@/lib/seo'

export async function generateStaticParams() {
  return (await getMembers()).map((m) => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug
  const p = await getProfile(slug)
  if (!p) return { title: 'Member' }
  return pageMeta(p.member.name, `${p.member.name} plays division ${p.member.division} at Deadly Drops Pickleball, Chula Vista: rating ${p.member.rating.toFixed(2)}, season record ${p.record}.`, `/members/${slug}/`)
}

export default async function MemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProfile((await params).slug)
  if (!p) notFound()
  return (
    <section className="section light">
      <div className="wrap">
        <p style={{ marginBottom: 24 }}><Link href="/members/" className="mono small">← All members</Link></p>
        <Dashboard p={p} />
      </div>
    </section>
  )
}
