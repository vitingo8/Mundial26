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

  const g = migrate(results?.group || {})
  const k = migrate(results?.knockout || {})

  function withTimestamps(map, rawTsMap) {
    if (!rawTsMap) return map
    const ts = migrate(rawTsMap)
    return Object.fromEntries(
      Object.entries(map).map(([id, result]) => {
        const t = ts[id]?.t
        return [id, t ? { ...result, _updatedAt: t } : result]
      }),
    )
  }

  const gFinal = withTimestamps(g, resultsUpdatedAt?.group)
  const kFinal = withTimestamps(k, resultsUpdatedAt?.knockout)

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
