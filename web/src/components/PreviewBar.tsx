/** Shown on the public site while the owner previews unpublished changes from the MIS. */
export function PreviewBar() {
  return (
    <div role="status" style={{ background: 'var(--ink)', color: 'var(--ink-dark)', padding: '10px 16px', textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
      Preview: you are seeing unpublished changes.{' '}
      <a href="/admin/" style={{ textDecoration: 'underline' }}>Back to the admin</a>{' · '}
      <a href="/admin/preview/?on=0&amp;path=/" style={{ textDecoration: 'underline' }}>Exit preview</a>
    </div>
  )
}
