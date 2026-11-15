import type { Metadata } from 'next'
import { MemberDirectory } from '@/components/MemberDirectory'
import { PageHero } from '@/components/PageHero'
import { getMembers } from '@/lib/data'

export const metadata: Metadata = { title: 'Members' }

export default async function MembersPage() {
  const members = await getMembers()
  return (
    <>
      <PageHero title={<>{members.length} people who show up</>} lede="Find a partner, size up your next opponent, or see who's moving up the ladder." />
      <section className="section-tight dark">
        <div className="wrap">
          <MemberDirectory members={members} />
        </div>
      </section>
    </>
  )
}
