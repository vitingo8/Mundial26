/**
 * Eliminatorias: empate en el marcador → elegir quién pasa (+1 pt si aciertas).
 */

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

/** +1 si predijiste empate, elegiste bien quién pasa y el resultado confirma ese clasificado */
export function calcKnockoutAdvanceBonus(prediction, result) {
  if (!prediction?.advances || !isKnockoutScoreDraw(prediction)) return 0
  const actual = resolveKnockoutAdvanceSide(result)
  if (!actual) return 0
  return prediction.advances === actual ? 1 : 0
}
