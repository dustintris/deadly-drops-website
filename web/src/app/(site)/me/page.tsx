import type { Metadata } from 'next'
import { Dashboard } from '@/components/Dashboard'
import { TonightCard } from '@/components/TonightCard'
import m from '@/components/me.module.css'
import { getMe, getProfile } from '@/lib/data'
import { pageMeta } from '@/lib/seo'

export const metadata: Metadata = pageMeta('My play', 'Your Deadly Drops ladder, matches and results.', '/me/', { noindex: true })

export default async function MePage() {
  const me = await getMe()
  const profile = (await getProfile(me.member.slug))!
  return (
    <div className={m.layout}>
      <section className="dark">
        <div className={m.side}>
          <TonightCard rank={me.ladderRank} tonight={me.tonight} />
        </div>
      </section>
      <section className="light">
        <div className={m.main}>
          <p className="small muted" style={{ marginBottom: 18 }}>Signed in as {me.member.first} · sample member account</p>
          <Dashboard p={profile} isMe />
        </div>
      </section>
    </div>
  )
}
