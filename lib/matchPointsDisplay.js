import { calcMatchPointsSplit, SCORING } from './gameData.js'
import { migratePredictionMap } from './matchIdMap.js'

/**
 * Resumen de puntos de un partido (predicción vs resultado publicado).
 * @returns {{ pts: number, detail: string, parts: string[] } | null}
 */
export function summarizeMatchPoints(prediction, result, opts = {}) {
  if (!prediction || result?.home == null || result?.away == null) return null
  const split = calcMatchPointsSplit(prediction, result, opts)
  const pts = split.gep + split.resultado + split.advance
  const parts = []
  if (split.gep > 0) parts.push(`+${SCORING.correctOutcome} (1X2)`)
  if (split.resultado > 0) parts.push(`+${SCORING.exactScore} exacto`)
  if (split.advance > 0) parts.push(`+${SCORING.knockoutAdvance} pasa`)
  return {
    pts,
    detail: pts === 0 ? 'Sin puntos' : parts.join(' · '),
    parts,
  }
}

/** Resultado publicado para un id (grupos o KO / inicio-ko). */
export function getPublishedResult(matchId, results = {}) {
  const id = String(matchId)
  const g = results?.group?.[id]
  if (g?.home != null && g?.away != null) return g
  const k = results?.knockout?.[id]
  if (k?.home != null && k?.away != null) return k
  return null
}

export function hasPublishedGroupResults(results) {
  return Object.keys(results?.group || {}).some(
    id => results.group[id]?.home != null && results.group[id]?.away != null,
  )
}

export function isInicioKoId(id) {
  const s = String(id)
  return s.startsWith('inicio-ko-') || s.startsWith('inicio-r32-')
}

/**
 * Mapa id → resultado para mostrar en la pestaña Porra.
 * Si se pasa `resultsUpdatedAt` (misma forma que `results`, valores `{ t: ISO }`),
 * cada resultado incluye `_updatedAt` con la última vez que cambió ese marcador.
 */
export function buildPublishedResultsMap(results, phase = 'group', canonicalMatches = [], resultsUpdatedAt = null) {
  const migrate = map =>
    canonicalMatches.length ? migratePredictionMap(map, canonicalMatches).migrated : map

  const rawG = results?.group || {}
  const rawK = results?.knockout || {}
  const g = migrate(rawG)
  const k = migrate(rawK)

  function buildTimestampByMatchNumber(resultsMap, tsMap) {
    const byNum = {}
    for (const [id, result] of Object.entries(resultsMap)) {
      const num = result?.matchNumber
      const t = tsMap?.[id]?.t
      if (num != null && t) byNum[num] = t
    }
    for (const [id, tObj] of Object.entries(tsMap || {})) {
      const t = tObj?.t
      if (!t) continue
      const ko = /^knockout-ko-(\d+)$/.exec(id)
      const inicio = /^inicio-ko-(\d+)$/.exec(id)
      const num = ko ? Number(ko[1]) : inicio ? Number(inicio[1]) : null
      if (num != null) byNum[num] = t
    }
    return byNum
  }

  function withTimestamps(map, rawTsMap, tsByMatchNumber = {}) {
    if (!rawTsMap && !Object.keys(tsByMatchNumber).length) return map
    const ts = rawTsMap
      ? (canonicalMatches.length ? migratePredictionMap(rawTsMap, canonicalMatches).migrated : rawTsMap)
      : {}
    return Object.fromEntries(
      Object.entries(map).map(([id, result]) => {
        const t =
          ts[id]?.t
          || (result?.matchNumber != null ? tsByMatchNumber[result.matchNumber] : null)
        return [id, t ? { ...result, _updatedAt: t } : result]
      }),
    )
  }

  const gFinal = withTimestamps(g, resultsUpdatedAt?.group, buildTimestampByMatchNumber(rawG, resultsUpdatedAt?.group || {}))
  const knockoutTsByNum = buildTimestampByMatchNumber(rawK, resultsUpdatedAt?.knockout || {})
  const kFinal = withTimestamps(k, resultsUpdatedAt?.knockout, knockoutTsByNum)

  if (phase === 'knockout') {
    return Object.fromEntries(
      Object.entries(kFinal).filter(([id]) => !isInicioKoId(id)),
    )
  }
  const inicio = Object.fromEntries(Object.entries(kFinal).filter(([id]) => isInicioKoId(id)))
  return { ...gFinal, ...inicio }
}

export function countPublishedInMap(map) {
  return Object.values(map || {}).filter(r => r?.home != null && r?.away != null).length
}
