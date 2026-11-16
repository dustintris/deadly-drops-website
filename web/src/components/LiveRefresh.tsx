'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useLive } from '@/lib/live/useLive'

/**
 * Keeps a server-rendered page current: re-renders it (router.refresh) whenever the tournament's
 * scores, teams or schedule change, at most every ~half second. Shows a quiet note while offline.
 */
export function LiveRefresh({ tournamentId, version }: { tournamentId: number; version: number }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // don't refresh a page that has already been left
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const { online } = useLive(
    tournamentId,
    () => {
      if (timer.current) return
      timer.current = setTimeout(() => {
        timer.current = null
        router.refresh()
      }, 400)
    },
    version,
  )
  return online ? null : (
    <p role="status" className="live-offline">
      Offline: reconnecting… Scores shown may be out of date.
    </p>
  )
}
