'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildLiveClockAnchor,
  formatPausedLiveClock,
  formatSimulatedClock,
  isLiveClockPaused,
} from '../lib/liveClock'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

/**
 * Reloj en vivo que avanza segundo a segundo entre actualizaciones de la API.
 * Solo se resincroniza si FotMob avanza el tiempo (nunca hacia atrás).
 */
export function useSimulatedLiveClock({ liveTime, minute, status, enabled = true }) {
  const [now, setNow] = useState(() => Date.now())
  const [syncedAt, setSyncedAt] = useState(() => Date.now())
  const [activeAnchor, setActiveAnchor] = useState(null)

  const paused = isLiveClockPaused(status, liveTime)

  const incomingAnchor = useMemo(() => {
    if (!enabled || !LIVE_STATUSES.has(status)) return null
    if (paused) return null
    return buildLiveClockAnchor(liveTime, minute)
  }, [enabled, status, paused, liveTime, minute, liveTime?.long, liveTime?.short, liveTime?.addedTime])

  useEffect(() => {
    if (!incomingAnchor) {
      setActiveAnchor(null)
      return
    }
    setActiveAnchor(prev => {
      if (!prev || incomingAnchor.totalSeconds > prev.totalSeconds) {
        setSyncedAt(Date.now())
        return incomingAnchor
      }
      if (incomingAnchor.addedTime !== prev.addedTime) {
        return { ...prev, addedTime: incomingAnchor.addedTime }
      }
      return prev
    })
  }, [incomingAnchor])

  useEffect(() => {
    if (!activeAnchor || paused) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [activeAnchor?.key, paused])

  return useMemo(() => {
    if (!enabled || !LIVE_STATUSES.has(status)) return null
    if (paused) return formatPausedLiveClock()
    if (!activeAnchor) return null
    const elapsed = Math.floor((now - syncedAt) / 1000)
    return formatSimulatedClock(activeAnchor, elapsed)
  }, [enabled, status, paused, activeAnchor, now, syncedAt])
}
