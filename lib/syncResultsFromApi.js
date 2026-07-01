import { finishedMatchesToResults } from './adminCsv'
import { getApiMatchDisplayScore } from './apiMatchScores'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

/** Combina resultados guardados con partidos FINISHED de la API. */
export function buildMergedResults(wcMatches, stored) {
  const { group, knockout } = finishedMatchesToResults(wcMatches)
  return {
    group: { ...(stored?.group || {}), ...group },
    knockout: { ...(stored?.knockout || {}), ...knockout },
  }
}

export function resultsNeedSync(stored, merged) {
  return JSON.stringify(stored || { group: {}, knockout: {} }) !== JSON.stringify(merged)
}

/** Hay resultados guardados sin marca de tiempo (p. ej. columna añadida después). */
export function timestampsNeedSync(storedResults, storedTimestamps, mergedResults) {
  for (const phase of ['group', 'knockout']) {
    const mergedPhase = mergedResults?.[phase] || {}
    const tsPhase = storedTimestamps?.[phase] || {}
    for (const [matchId, result] of Object.entries(mergedPhase)) {
      if (result?.home == null || result?.away == null) continue
      if (!tsPhase[matchId]?.t) return true
    }
  }
  return false
}

function scoresEqual(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.home === b.home && a.away === b.away
}

/**
 * Marca (ISO) de cuándo cambió por última vez el marcador de cada partido.
 * Compara `prevResults` vs `mergedResults`; conserva `prevTimestamps` si el
 * marcador (home/away) no cambió, o lo actualiza a `nowIso` si cambió o es nuevo.
 * Forma: { group: { [matchId]: { t: ISO } }, knockout: { [matchId]: { t: ISO } } }
 */
export function buildResultTimestamps(prevResults, prevTimestamps, mergedResults, nowIso = new Date().toISOString()) {
  const out = {}
  for (const phase of ['group', 'knockout']) {
    const prevPhase = prevResults?.[phase] || {}
    const prevTsPhase = prevTimestamps?.[phase] || {}
    const mergedPhase = mergedResults?.[phase] || {}
    const outPhase = {}
    for (const [matchId, result] of Object.entries(mergedPhase)) {
      const unchanged = scoresEqual(prevPhase[matchId], result)
      const prevT = prevTsPhase[matchId]?.t
      outPhase[matchId] = { t: unchanged && prevT ? prevT : nowIso }
    }
    out[phase] = outPhase
  }
  return out
}

export function countFinishedFromApi(wcMatches) {
  const { group, knockout } = finishedMatchesToResults(wcMatches)
  return {
    group: Object.keys(group).length,
    knockout: Object.keys(knockout).length,
  }
}

/** Resultados oficiales + marcadores en vivo para ranking provisional. */
export function buildProvisionalResults(stored, wcMatches) {
  const base = buildMergedResults(wcMatches, stored)
  const liveOverlay = {}
  for (const m of wcMatches || []) {
    if (m.stage && m.stage !== 'GROUP_STAGE') continue
    if (!LIVE_STATUSES.has(m.status)) continue
    const display = getApiMatchDisplayScore(m)
    if (display) liveOverlay[String(m.id)] = display
  }
  return {
    group: { ...base.group, ...liveOverlay },
    knockout: base.knockout,
  }
}

export function hasProvisionalLiveResults(wcMatches) {
  return (wcMatches || []).some(m =>
    (!m.stage || m.stage === 'GROUP_STAGE')
    && LIVE_STATUSES.has(m.status)
    && getApiMatchDisplayScore(m),
  )
}
