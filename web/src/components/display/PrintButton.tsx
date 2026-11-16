'use client'

import s from '@/components/print.module.css'

export function PrintButton() {
  return <button type="button" className={s.btn} onClick={() => window.print()}>Print</button>
}
