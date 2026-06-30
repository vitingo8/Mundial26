/**
 * Eliminatorias: el marcador de porra (1X2 / exacto) es al pitido del 90',
 * no incluye prórroga ni penaltis. El +1 "pasa" usa al ganador del cruce (prórroga o penaltis).
 */

import { isKnockoutScoreDraw } from './knockoutAdvances.js'
import { inferKnockoutAdvancesFromApiMatch } from './knockoutAdvances.js'

function ftHalfEvent(apiMatch) {
  return (apiMatch?.rawEvents || []).find(
    e => e.type === 'Half' && (e.halfStrShort === 'FT' || e.halfStrKey === 'fulltime_short'),
  )
}

function hadExtraTime(apiMatch) {
  return (apiMatch?.rawEvents || []).some(
    e => e.type === 'Half' && (e.halfStrShort === 'AET' || e.halfStrKey === 'afterextratime_short'),
  )
}

/** Marcador al final de los 90 minutos (sin prórroga). */
export function getRegulationTimeScore(apiMatch) {
  if (!apiMatch) return null

  const cached = apiMatch.score?.regulationTime
  if (cached?.home != null && cached?.away != null) {
    return { home: cached.home, away: cached.away }
  }

  const ftHalf = ftHalfEvent(apiMatch)
  if (ftHalf?.homeScore != null && ftHalf?.awayScore != null) {
    return { home: ftHalf.homeScore, away: ftHalf.awayScore }
  }

  const ft = apiMatch.score?.fullTime
  if (ft?.home == null || ft?.away == null) return null

  if (!hadExtraTime(apiMatch)) {
    return { home: ft.home, away: ft.away }
  }

  return null
}

/** Resultado publicado/API normalizado para puntuar eliminatorias. */
export function normalizeKnockoutResultForScoring(result, apiMatch) {
  if (!result || result.home == null || result.away == null) return result

  const reg = apiMatch ? getRegulationTimeScore(apiMatch) : null
  const home = reg?.home ?? result.home
  const away = reg?.away ?? result.away

  let advances = result.advances === 'home' || result.advances === 'away'
    ? result.advances
    : null

  if (!advances && isKnockoutScoreDraw({ home, away }) && apiMatch) {
    advances = inferKnockoutAdvancesFromApiMatch(apiMatch)
  }

  return {
    ...result,
    home,
    away,
    ...(advances ? { advances } : {}),
  }
}

/** Normaliza resultado publicado/API (90' + advances si aplica). */
export function enrichKnockoutResultWithAdvances(result, apiMatch) {
  return normalizeKnockoutResultForScoring(result, apiMatch)
}
