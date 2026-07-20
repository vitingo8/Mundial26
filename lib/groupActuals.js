export const ACTUALS_FIELDS = ['topScorer', 'topKeeper', 'topAssists', 'mvp']

/** Ganadores reales completos (los 4 premios especiales). */
export function isGroupActualsComplete(actuals) {
  return ACTUALS_FIELDS.every(f => String(actuals?.[f] ?? '').trim())
}
