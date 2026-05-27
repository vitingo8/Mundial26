/** Plaza FIFA sin equipo aún (1A, W73, G89, 3B/C/D…). */
const FIFA_PLACEHOLDER_RE = /^[123WLPG][\dA-L/]*$/i

export function isFifaPlaceholderSide(name) {
  if (!name || name === '—') return true
  return FIFA_PLACEHOLDER_RE.test(String(name).trim())
}

/** Partido de porra real: ambos equipos ya son selecciones, no cruces teóricos. */
export function isRealKnockoutMatchForPorra(match) {
  if (!match) return false
  return !isFifaPlaceholderSide(match.home) && !isFifaPlaceholderSide(match.away)
}

export function isGroupStageComplete(groupMatches = [], groupPhase) {
  if (groupPhase === 'knockout' || groupPhase === 'finished') return true
  if (!groupMatches?.length) return false
  return groupMatches.every(m => m.status === 'FINISHED')
}

/** Dieciseisavos editables cuando termina grupos o la API ya publica equipos. */
export function shouldIncludeR32InRealPorra(groupMatches, groupPhase, scheduleMatches = []) {
  if (isGroupStageComplete(groupMatches, groupPhase)) return true
  const r32 = scheduleMatches.filter(m => m.roundId === 'r32')
  return r32.some(isRealKnockoutMatchForPorra)
}

/**
 * Calendario de Eliminatorias (40%): solo partidos con equipos reales.
 * Oculta dieciseisavos hasta que acabe la fase de grupos (salvo que la API ya los tenga).
 */
export function filterRealKnockoutPorraSchedule(
  scheduleMatches = [],
  { groupMatches = [], groupPhase } = {},
) {
  const includeR32 = shouldIncludeR32InRealPorra(groupMatches, groupPhase, scheduleMatches)
  return scheduleMatches.filter(m => {
    if (!isRealKnockoutMatchForPorra(m)) return false
    if (!includeR32 && m.roundId === 'r32') return false
    return true
  })
}
