import { finishedMatchesToResults } from './adminCsv.js'
import { getRegulationTimeScore } from './knockoutRegulationScore.js'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'TIMED', 'POSTPONED', 'CANCELLED'])

/** Partido con pitido inicial (o ya finalizado). */
export function isMatchStarted(rawMatch) {
  if (!rawMatch) return false
  if (rawMatch.status === 'FINISHED') return true
  if (UPCOMING_STATUSES.has(rawMatch.status)) return false
  return LIVE_STATUSES.has(rawMatch.status)
}

/** Marcador visible (finalizado o en juego). Eliminatorias finalizadas: solo 90'. */
export function getApiMatchDisplayScore(rawMatch) {
  if (!rawMatch || !isMatchStarted(rawMatch)) return null
  if (
    rawMatch.status === 'FINISHED'
    && rawMatch.stage
    && rawMatch.stage !== 'GROUP_STAGE'
  ) {
    const reg = getRegulationTimeScore(rawMatch)
    if (reg) return reg
  }
  const ft = rawMatch.score?.fullTime
  if (ft?.home != null && ft?.away != null) {
    return { home: ft.home, away: ft.away }
  }
  if (LIVE_STATUSES.has(rawMatch.status)) {
    const ht = rawMatch.score?.halfTime
    if (ht?.home != null && ht?.away != null) {
      return { home: ht.home, away: ht.away }
    }
  }
  return null
}

/** Mapa id → marcador para clasificación (solo partidos finalizados). */
export function finishedGroupScoresFromApi(apiMatches) {
  return finishedMatchesToResults(apiMatches).group
}

/** Marcadores para tabla en vivo: finalizados + partidos en juego con marcador actual. */
export function groupScoresFromApi(apiMatches) {
  const scores = { ...finishedGroupScoresFromApi(apiMatches) }
  for (const m of apiMatches || []) {
    if (m.stage && m.stage !== 'GROUP_STAGE') continue
    if (m.status === 'FINISHED') continue
    const display = getApiMatchDisplayScore(m)
    if (display) scores[String(m.id)] = display
  }
  return scores
}

export function normalizeGroupKey(group) {
  if (!group) return null
  return String(group).replace(/^GROUP_/i, '').toUpperCase()
}

/** Índice rápido de partidos crudos por id. */
export function indexApiMatches(apiMatches) {
  const map = {}
  for (const m of apiMatches || []) {
    map[String(m.id)] = m
  }
  return map
}
