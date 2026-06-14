const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'TIMED'])

/** Partido en juego o en descanso. */
export function hasLiveWcMatches(list) {
  return (list || []).some(m => LIVE_STATUSES.has(m.status))
}

/** Pitido en las próximas `withinMs` (p. ej. detectar inicio de partido). */
export function hasUpcomingWcMatchesSoon(list, withinMs = 2 * 60 * 60 * 1000) {
  const now = Date.now()
  return (list || []).some(m => {
    if (!UPCOMING_STATUSES.has(m.status) || !m.utcDate) return false
    const kickoff = new Date(m.utcDate).getTime()
    if (!Number.isFinite(kickoff)) return false
    const delta = kickoff - now
    return delta > 0 && delta <= withinMs
  })
}

/**
 * Intervalo de refresco en ms. `null` = no hacer polling (pestaña oculta).
 * En vivo: ~12 s · partido pronto: ~60 s · reposo: ~5 min.
 */
export function getWcMatchesPollIntervalMs(list, { visible = true } = {}) {
  if (!visible) return null
  if (hasLiveWcMatches(list)) return 12_000
  if (hasUpcomingWcMatchesSoon(list)) return 60_000
  return 5 * 60_000
}
