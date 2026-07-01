/** ISO UTC de cuándo el usuario guardó esta predicción de partido. */
export const PRED_SAVED_AT_KEY = 't'

function predPayloadEqual(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.home === b.home && a.away === b.away && a.advances === b.advances
}

function stampMap(nextMap = {}, prevMap = {}, nowIso) {
  const out = {}
  for (const [id, pred] of Object.entries(nextMap || {})) {
    if (!pred || typeof pred !== 'object') continue
    if (pred.home == null && pred.away == null && pred.advances == null) continue
    const prev = prevMap?.[id]
    const unchanged = predPayloadEqual(pred, prev)
    if (unchanged) {
      const prevT = prev?.[PRED_SAVED_AT_KEY]
      if (prevT) out[id] = { ...pred, [PRED_SAVED_AT_KEY]: prevT }
      else {
        const { [PRED_SAVED_AT_KEY]: _t, ...rest } = pred
        out[id] = rest
      }
    } else {
      out[id] = { ...pred, [PRED_SAVED_AT_KEY]: nowIso }
    }
  }
  return out
}

/** Añade/actualiza `t` en cada partido cuyo marcador cambió respecto a lo ya guardado. */
export function stampPredictionsOnSave(next, prev, nowIso = new Date().toISOString()) {
  const p = prev && typeof prev === 'object' ? prev : {}
  return {
    group: stampMap(next?.group, p.group, nowIso),
    knockout: stampMap(next?.knockout, p.knockout, nowIso),
    inicioKnockout: stampMap(next?.inicioKnockout, p.inicioKnockout, nowIso),
    bonuses: { ...(next?.bonuses || p.bonuses || {}) },
  }
}

function stripMapTimestamps(map = {}) {
  return Object.fromEntries(
    Object.entries(map).map(([id, pred]) => {
      if (!pred || typeof pred !== 'object') return [id, pred]
      const { [PRED_SAVED_AT_KEY]: _t, ...rest } = pred
      return [id, rest]
    }),
  )
}

/** Comparar predicciones ignorando marcas de tiempo (para autosave / dirty check). */
export function stripPredTimestampsForCompare(predictions = {}) {
  return {
    group: stripMapTimestamps(predictions.group),
    knockout: stripMapTimestamps(predictions.knockout),
    inicioKnockout: stripMapTimestamps(predictions.inicioKnockout),
    bonuses: { ...(predictions.bonuses || {}) },
  }
}

export function getPredSavedAt(pred) {
  const t = pred?.[PRED_SAVED_AT_KEY]
  return typeof t === 'string' && t.trim() ? t : null
}
