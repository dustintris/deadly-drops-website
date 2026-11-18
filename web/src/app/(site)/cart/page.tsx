import { permanentRedirect } from 'next/navigation'

/** The shop is a catalogue (no online payment), so there is no cart: an old /cart/ link lands on the shop. */
export default function CartPage(): never {
  permanentRedirect('/shop/')
}
