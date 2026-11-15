import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Dashboard } from '@/components/Dashboard'
import { getMembers, getProfile } from '@/lib/data'

export async function generateStaticParams() {
  return (await getMembers()).map((m) => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProfile((await params).slug)
  return { title: p ? p.member.name : 'Member' }
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
