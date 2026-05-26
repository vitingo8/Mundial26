import { finishedMatchesToResults } from './adminCsv'

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
