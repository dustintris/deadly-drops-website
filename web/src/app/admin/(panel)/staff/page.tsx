import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { listUsers } from '@/lib/auth/users'
import { StaffManager } from './StaffManager'

export const metadata = { title: 'Staff logins' }
export const dynamic = 'force-dynamic'

export default async function StaffAdmin() {
  const s = await requirePermission('staff', 'view') // each page checks: a layout check alone can be skipped by partial rendering
  const users = await listUsers()
  const canEdit = can(s, 'staff', 'edit')
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Staff logins</h1>
          <p className="adm-muted">
            {canEdit
              ? 'Give each helper their own login and only the access they need. Changes apply straight away.'
              : 'Who can sign in to the admin, and what each person can do. You can look but not change anything here.'}
          </p>
        </div>
      </div>
      <StaffManager users={users} me={{ id: s.id, isOwner: s.isOwner, perms: s.perms }} canEdit={canEdit} now={Date.now()} />
    </>
  )
}
