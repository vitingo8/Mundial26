/**
 * Eliminatorias: empate a 90' → elegir quién pasa; +1 pt si aciertas al clasificado (prórroga o penaltis).
 */

import { teamsMatch } from './fifaMatchNumbers.js'

export const ADVANCE_SIDE = /** @type {const} */ (['home', 'away'])

/** @param {{ home?: number, away?: number } | null | undefined} row */
export function isKnockoutScoreDraw(row) {
  if (!row || row.home == null || row.away == null) return false
  const h = Number(row.home)
  const a = Number(row.away)
  return !Number.isNaN(h) && !Number.isNaN(a) && h === a
}

/** @param {{ home?: number, away?: number, advances?: string } | null | undefined} pred */
export function needsKnockoutAdvancePick(pred) {
  return isKnockoutScoreDraw(pred)
}

/**
 * Lado que pasa según marcador o, si empate, `advances`.
 * @returns {'home'|'away'|null}
 */
export function resolveKnockoutAdvanceSide(row) {
  if (!row || row.home == null || row.away == null) return null
  const h = Number(row.home)
  const a = Number(row.away)
  if (Number.isNaN(h) || Number.isNaN(a)) return null
  if (h > a) return 'home'
  if (a > h) return 'away'
  if (row.advances === 'home' || row.advances === 'away') return row.advances
  return null
}

/**
 * @param {{ home?: number, away?: number, advances?: string } | null} pred
 * @param {{ home: string, away: string, homeCrest?: string | null, awayCrest?: string | null }} teams
 */
export function resolveKnockoutWinnerTeam(pred, teams) {
  const side = resolveKnockoutAdvanceSide(pred)
  if (!side || !teams) return null
  if (side === 'home') {
    return { side, name: teams.home, crest: teams.homeCrest ?? null }
  }
  return { side, name: teams.away, crest: teams.awayCrest ?? null }
}

/**
 * @param {Record<string, { home?: number, away?: number, advances?: string }>} preds
 * @param {string} id
 * @param {'home'|'away'} side
 * @param {number|string} val
 */
export function patchKnockoutScore(preds, id, side, val) {
  if (val === '' || val === undefined) {
    const next = { ...(preds[id] || {}) }
    delete next[side]
    if (Object.keys(next).length === 0 || (next.home == null && next.away == null && !next.advances)) {
      const { [id]: _, ...rest } = preds
      return rest
    }
    const h = next.home
    const a = next.away
    if (h == null || a == null || Number(h) !== Number(a)) delete next.advances
    return { ...preds, [id]: next }
  }

  const v = parseInt(val, 10)
  if (Number.isNaN(v) || v < 0 || v > 20) return preds

  const next = { ...(preds[id] || {}), [side]: v }
  const h = next.home
  const a = next.away
  if (h == null || a == null || Number(h) !== Number(a)) delete next.advances
  return { ...preds, [id]: next }
}

export function patchKnockoutAdvance(preds, id, side) {
  if (side !== 'home' && side !== 'away') return preds
  return {
    ...preds,
    [id]: { ...(preds[id] || {}), advances: side },
  }
}

/** Ganador en tanda de penaltis (evento FotMob `PenaltyShootout`). */
export function advancesFromPenaltyShootoutEvent(event) {
  if (!event || event.type !== 'PenaltyShootout') return null
  const h = Number(event.homeScore)
  const a = Number(event.awayScore)
  if (Number.isNaN(h) || Number.isNaN(a)) return null
  if (h > a) return 'home'
  if (a > h) return 'away'
  return null
}

/**
 * Quién pasa según ganador del cruce (prórroga o penaltis si empate a 90').
 * @returns {'home'|'away'|null}
 */
export function inferKnockoutAdvancesFromApiMatch(apiMatch) {
  if (!apiMatch?.score) return null
  const winner = apiMatch.score.winner
  if (winner === 'HOME_TEAM') return 'home'
  if (winner === 'AWAY_TEAM') return 'away'
  const fromScore = apiMatch.score.penaltyShootoutWinner ?? apiMatch.penaltyShootoutWinner
  if (fromScore === 'home' || fromScore === 'away') return fromScore
  const reason = apiMatch.statusReason || apiMatch.status?.reason
  if (
    isKnockoutScoreDraw({ home: apiMatch.score?.fullTime?.home, away: apiMatch.score?.fullTime?.away })
    && reason?.shortKey === 'penalties_short'
    && apiMatch.score?.winner === 'HOME_TEAM'
  ) {
    return 'home'
  }
  if (
    isKnockoutScoreDraw({ home: apiMatch.score?.fullTime?.home, away: apiMatch.score?.fullTime?.away })
    && reason?.shortKey === 'penalties_short'
    && apiMatch.score?.winner === 'AWAY_TEAM'
  ) {
    return 'away'
  }
  for (const ev of apiMatch.rawEvents || apiMatch.penaltyShootoutEvents || []) {
    const side = advancesFromPenaltyShootoutEvent(ev)
    if (side) return side
  }
  return null
}

/**
 * +1 si aciertas qué selección pasa.
 * Con equipos resueltos compara por nombre; si no, por lado local/visitante.
 */
export function calcKnockoutAdvanceBonus(prediction, result, opts = {}) {
  const { predictedTeams, actualTeams } = opts
  if (predictedTeams?.home && predictedTeams?.away && actualTeams?.home && actualTeams?.away) {
    const pw = resolveKnockoutWinnerTeam(prediction, predictedTeams)
    const aw = resolveKnockoutWinnerTeam(result, actualTeams)
    if (pw?.name && aw?.name) {
      return teamsMatch(pw.name, aw.name) ? 1 : 0
    }
    return 0
  }
  const predicted = resolveKnockoutAdvanceSide(prediction)
  const actual = resolveKnockoutAdvanceSide(result)
  if (!predicted || !actual) return 0
  return predicted === actual ? 1 : 0
}
