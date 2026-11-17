import { getNextEvent } from '@/lib/data'
import { asset, money } from '@/lib/utils'
import { AuthForm } from './AuthForm'
import styles from './auth.module.css'

export async function AuthScreen({ initial }: { initial: 'login' | 'signup' }) {
  const event = await getNextEvent()
  return (
    <section className={styles.auth}>
      <div className={styles.visual}>
        <img src={asset('/images/club/court-group-photo.jpg')} alt="" />
        <div className={styles.visualCopy}>
          <p className="display d-m">Everybody&rsquo;s welcome. Nobody coasts.</p>
          <p className="muted">One account for the ladder and the shop discount. Tournament entry is on Main Court.</p>
          <dl>
            <div className="stat"><dt className="sr">Entry</dt><dd><strong className="accent">{event ? money(event.entryFee) : 'All'}</strong><span>{event ? 'Tournament entry' : 'Levels welcome'}</span></dd></div>
            <div className="stat"><dt className="sr">Divisions</dt><dd><strong>DUPR</strong><span>Fair divisions</span></dd></div>
            <div className="stat"><dt className="sr">Charity</dt><dd><strong>Charity</strong><span>Every tournament</span></dd></div>
          </dl>
        </div>
      </div>
      <AuthForm initial={initial} />
    </section>
  )
}
