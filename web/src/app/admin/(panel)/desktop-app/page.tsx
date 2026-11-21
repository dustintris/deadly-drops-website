import { headers } from 'next/headers'
import { codeSecretReady } from '@/lib/appsync/codes'
import { skippedTeams } from '@/lib/appsync/export'
import { listInstalls, listOpenCodes, type DesktopInstall } from '@/lib/appsync/installs'
import { appKeyStatus } from '@/lib/appsync/key'
import { loadAllForApp } from '@/lib/appsync/load'
import { DOWNLOAD_PREFIX, readLatestRelease, type DesktopRelease } from '@/lib/appsync/release'
import { siteAddress } from '@/lib/appsync/site'
import { requirePermission } from '@/lib/auth/session'
import { ActivationPanel, type InstallRow } from './ActivationPanel'
import { KeyPanel } from './KeyPanel'

export const metadata = { title: 'Desktop app' }
export const dynamic = 'force-dynamic'

const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', year: 'numeric' })
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`
// only what the table needs goes to the browser (not who made the code, nor the app's install id)
const row = (i: DesktopInstall): InstallRow => ({
  id: i.id, label: i.label, deviceName: i.deviceName, lastVersion: i.lastVersion,
  activatedAt: i.activatedAt, lastSeenAt: i.lastSeenAt, revokedAt: i.revokedAt,
})

/** The Windows installer, as the release pipeline left it in DOWNLOADS_DIR/desktop/. */
function Download({ release }: { release: DesktopRelease | null }) {
  const facts = release
    ? [`Version ${release.version}`, release.sizeBytes ? mb(release.sizeBytes) : null, release.releaseDate ? `released ${DAY.format(new Date(release.releaseDate))}` : null]
        .filter(Boolean)
        .join(' · ')
    : ''
  return (
    <section className="adm-card" aria-labelledby="download-h">
      <h2 id="download-h">Download for Windows</h2>
      {!release ? (
        <p className="adm-muted">No installer has been published yet. It appears here after the next release of the app.</p>
      ) : release.file && release.onDisk ? (
        <>
          <div className="adm-actions">
            {/* served by the web server itself (signed-in staff only), so a plain link: not a page of this site */}
            <a className="adm-btn primary" href={`${DOWNLOAD_PREFIX}${encodeURIComponent(release.file)}`} download>
              Download the app for Windows
            </a>
            <span className="adm-muted">{facts}</span>
          </div>
          <p className="adm-muted">
            Only signed-in staff managers can download it. Once a computer is activated, the app keeps itself up to
            date: new versions download in the background and install when the app restarts.
          </p>
        </>
      ) : (
        <p className="adm-note bad">
          Version {release.version} was published, but its installer file isn’t on the server. Publish the release again.
        </p>
      )}
    </section>
  )
}

/** The desktop Pickle Match app (the offline backup): download it, activate computers, and see which ones can connect. */
export default async function DesktopAppAdmin() {
  await requirePermission('staff', 'edit') // each page checks: a layout check alone can be skipped by partial rendering
  const [status, all, h, release, codes, installs] = await Promise.all([
    appKeyStatus(),
    loadAllForApp(),
    headers(),
    readLatestRelease(),
    listOpenCodes(),
    listInstalls(),
  ])
  const server = siteAddress(h.get('host'))
  const skipped = all.flatMap((t) => skippedTeams(t).map((x) => ({ ...x, tournament: t.name })))

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Desktop app</h1>
          <p className="adm-muted">
            The Deadly Drops Pickleball desktop app runs tournaments offline and downloads tournaments and teams from
            this website as a backup on tournament day. It only works on computers activated here.
          </p>
        </div>
      </div>
      <Download release={release} />
      <ActivationPanel
        ready={codeSecretReady()}
        codes={codes.map((c) => ({ id: c.id, label: c.label, createdBy: c.createdBy, expiresAt: c.expiresAt }))}
        active={installs.active.map(row)}
        revoked={installs.revoked.map(row)}
        revokedTotal={installs.revokedTotal}
      />
      <section className="adm-card" aria-labelledby="skip-h" style={{ display: 'grid', gap: 10 }}>
        <h2 id="skip-h">Teams the app won’t get ({skipped.length})</h2>
        {skipped.length === 0 ? (
          <p className="adm-muted">None: every team has two players, which is what the desktop app needs.</p>
        ) : (
          <>
            <p className="adm-muted">The desktop app needs two players per team. Add a partner under Tournaments → Teams &amp; schedule.</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {skipped.map((x, i) => <li key={i}>{x.tournament} · {x.division} · {x.team}</li>)}
            </ul>
          </>
        )}
      </section>
      <KeyPanel server={server} set={status.set} createdAt={status.createdAt} />
    </>
  )
}
