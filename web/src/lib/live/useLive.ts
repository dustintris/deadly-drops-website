'use client'

import { useEffect, useRef, useState } from 'react'
import { asset } from '@/lib/utils'

/**
 * Follow a tournament's live channel (/live/<id>/). Calls `onChange` whenever its live version moves
 * past the one this screen last saw. Disconnects while the tab is hidden and catches up on return.
 * `online` is false while the connection is down (the browser keeps retrying every 3 s).
 */
export function useLive(tournamentId: number, onChange: () => void, initialVersion?: number): { online: boolean } {
  const [online, setOnline] = useState(true)
  const seen = useRef<number | undefined>(initialVersion)
  const callback = useRef(onChange)
  callback.current = onChange

  useEffect(() => {
    let source: EventSource | null = null
    const open = () => {
      if (source) return
      source = new EventSource(asset(`/live/${tournamentId}/`))
      source.onopen = () => setOnline(true)
      // CLOSED = the server refused for good (e.g. the tournament was hidden): stop, without a "reconnecting" banner
      source.onerror = () => setOnline(source?.readyState === EventSource.CLOSED)
      source.onmessage = (e) => {
        setOnline(true)
        const v = (JSON.parse(e.data) as { v: number }).v
        if (seen.current !== undefined && v !== seen.current) callback.current()
        seen.current = v
      }
    }
    const close = () => {
      source?.close()
      source = null
    }
    const onVisibility = () => (document.hidden ? close() : open())
    if (!document.hidden) open()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      close()
    }
  }, [tournamentId])

  return { online }
}
