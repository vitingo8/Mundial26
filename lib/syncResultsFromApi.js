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
