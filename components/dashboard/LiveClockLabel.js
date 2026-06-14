'use client'

import { useSimulatedLiveClock } from '../../hooks/useSimulatedLiveClock'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

/**
 * Reloj en vivo unificado (MM:SS o HT en descanso) para floating, porra, tabla y detalle.
 */
export default function LiveClockLabel({
  liveTime,
  minute,
  status,
  className = '',
  pausedClassName = '',
}) {
  const isLive = LIVE_STATUSES.has(status)
  const liveClock = useSimulatedLiveClock({
    liveTime,
    minute,
    status,
    enabled: isLive,
  })

  if (!isLive || !liveClock?.compact) return null

  const isPaused = liveClock.compact === 'HT'

  return (
    <span
      className={[
        'live-clock-label',
        isPaused ? 'live-clock-label--paused' : '',
        isPaused && pausedClassName ? pausedClassName : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {liveClock.compact}
      {liveClock.addedTime && (
        <span className="live-clock-label__added">{liveClock.addedTime}</span>
      )}
    </span>
  )
}
