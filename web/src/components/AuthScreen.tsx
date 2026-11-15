import { getNextEvent } from '@/lib/data'
import { asset, money } from '@/lib/utils'
import { AuthForm } from './AuthForm'
import styles from './auth.module.css'

export async function AuthScreen({ initial }: { initial: 'login' | 'signup' }) {
  const event = await getNextEvent()
  return (
    <section className={styles.auth}>
      <div className={styles.visual}>
        <img src={asset('/images/stand-in/net-closeup.jpg')} alt="" />
        <div className={styles.visualCopy}>
          <p className="display d-m">Everybody&rsquo;s welcome. Nobody coasts.</p>
          <p className="muted">One account covers tournament entry, the ladder and the shop discount.</p>
          <dl>
            <div className="stat"><dt className="sr">Entry</dt><dd><strong className="accent">{money(event.entryFee)}</strong><span>Tournament entry</span></dd></div>
            <div className="stat"><dt className="sr">Divisions</dt><dd><strong>DUPR</strong><span>Fair divisions</span></dd></div>
            <div className="stat"><dt className="sr">Check-in</dt><dd><strong>QR</strong><span>Fast check-in</span></dd></div>
          </dl>
        </div>
      </div>
      <AuthForm initial={initial} />
    </section>
  )
}
