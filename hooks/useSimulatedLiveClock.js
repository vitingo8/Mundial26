'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildLiveClockAnchor,
  formatPausedLiveClock,
  formatSimulatedClock,
} from '../lib/liveClock'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

/**
 * Reloj en vivo que avanza segundo a segundo entre actualizaciones de la API.
 * Se resincroniza cuando llegan nuevos liveTime/minute de FotMob.
 */
export function useSimulatedLiveClock({ liveTime, minute, status, enabled = true }) {
  const [now, setNow] = useState(() => Date.now())
  const [syncedAt, setSyncedAt] = useState(() => Date.now())

  const anchor = useMemo(() => {
    if (!enabled || !LIVE_STATUSES.has(status)) return null
    if (status === 'PAUSED') return null
    return buildLiveClockAnchor(liveTime, minute)
  }, [enabled, status, liveTime, minute, liveTime?.long, liveTime?.short, liveTime?.addedTime])

  useEffect(() => {
    if (anchor) setSyncedAt(Date.now())
  }, [anchor?.key])

  useEffect(() => {
    if (!anchor || status === 'PAUSED') return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [anchor?.key, status])

  return useMemo(() => {
    if (!enabled || !LIVE_STATUSES.has(status)) return null
    if (status === 'PAUSED') return formatPausedLiveClock()
    if (!anchor) return null
    const elapsed = Math.floor((now - syncedAt) / 1000)
    return formatSimulatedClock(anchor, elapsed)
  }, [enabled, status, anchor, now, syncedAt])
}
