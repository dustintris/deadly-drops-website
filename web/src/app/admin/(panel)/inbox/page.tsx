import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { countSignups, listMessages, listSignups } from '@/lib/inbox/repo'
import { InboxView } from './InboxView'

const SHOWN_SIGNUPS = 200

export const metadata = { title: 'Inbox' }
export const dynamic = 'force-dynamic'

export default async function InboxAdmin() {
  const s = await requirePermission('content', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  // the page lists the newest sign-ups; the download has them all
  const [messages, signups, signupTotal] = await Promise.all([listMessages(), listSignups(SHOWN_SIGNUPS), countSignups()])
  const canEdit = can(s, 'content', 'edit')
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Inbox</h1>
          <p className="adm-muted">
            Messages from the Contact page and everyone who joined the email list in the footer. Reply from your own email
            {canEdit ? ', then mark the message as dealt with.' : '. You can read these but not change them.'}
          </p>
        </div>
      </div>
      <InboxView messages={messages} signups={signups} signupTotal={signupTotal} canEdit={canEdit} />
    </>
  )
}
