const EMPTY_BONUSES = { topScorer: '', topKeeper: '', topAssists: '', mvp: '' }
const INICIO_KO_ID_PREFIX = 'inicio-ko-'
const LEGACY_R32_PREFIX = 'inicio-r32-'

function isScoreFilled(val) {
  return val !== '' && val != null && !Number.isNaN(Number(val))
}

function isGroupPredFilled(pred) {
  return pred && isScoreFilled(pred.home) && isScoreFilled(pred.away)
}

function normalizeInicioKoPreds(preds = {}) {
  const out = { ...preds }
  for (const [key, val] of Object.entries(preds)) {
    if (!key.startsWith(LEGACY_R32_PREFIX)) continue
    const next = `${INICIO_KO_ID_PREFIX}${key.slice(LEGACY_R32_PREFIX.length)}`
    if (out[next] == null) out[next] = val
    delete out[key]
  }
  return out
}

export function normalizePredictions(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  return {
    group: { ...(p.group || {}) },
    knockout: { ...(p.knockout || {}) },
    inicioKnockout: normalizeInicioKoPreds(p.inicioKnockout || {}),
    bonuses: { ...EMPTY_BONUSES, ...(p.bonuses || {}) },
  }
}

function isKoPredFilled(pred) {
  if (!pred) return false
  if (isGroupPredFilled(pred)) return true
  return Boolean(pred.advances)
}

function countMapFilled(preds, checker = isGroupPredFilled) {
  return Object.values(preds || {}).filter(checker).length
}

function countBonusesFilled(bonuses) {
  return Object.values(bonuses || {}).filter(v => typeof v === 'string' && v.trim()).length
}

/** Resumen legible del progreso de una porra */
export function summarizePredictions(predictions) {
  const p = normalizePredictions(predictions)
  const group = countMapFilled(p.group)
  const knockout = countMapFilled(p.knockout, isKoPredFilled)
  const inicioKnockout = countMapFilled(p.inicioKnockout, isKoPredFilled)
  const bonuses = countBonusesFilled(p.bonuses)
  return {
    group,
    knockout,
    inicioKnockout,
    bonuses,
    total: group + knockout + inicioKnockout + bonuses,
  }
}

function mergeMatchMaps(target = {}, source = {}, isFilled) {
  const out = { ...target }
  for (const [id, srcVal] of Object.entries(source || {})) {
    if (!srcVal || !isFilled(srcVal)) continue
    if (!isFilled(out[id])) out[id] = { ...srcVal }
  }
  return out
}

function mergeBonuses(target = {}, source = {}) {
  const out = { ...EMPTY_BONUSES, ...target }
  for (const key of Object.keys(EMPTY_BONUSES)) {
    const cur = (out[key] || '').trim()
    const src = (source[key] || '').trim()
    if (!cur && src) out[key] = source[key]
  }
  return out
}

/**
 * @param {'replace'|'fillGaps'} mode
 * replace: la fuente sustituye por completo
 * fillGaps: solo rellena huecos en el destino
 */
export function mergePredictions(targetRaw, sourceRaw, mode = 'fillGaps') {
  const target = normalizePredictions(targetRaw)
  const source = normalizePredictions(sourceRaw)
  if (mode === 'replace') return source

  return {
    group: mergeMatchMaps(target.group, source.group, isGroupPredFilled),
    knockout: mergeMatchMaps(target.knockout, source.knockout, isKoPredFilled),
    inicioKnockout: mergeMatchMaps(
      target.inicioKnockout,
      source.inicioKnockout,
      isKoPredFilled,
    ),
    bonuses: mergeBonuses(target.bonuses, source.bonuses),
  }
}

export function formatMirrorSummary(summary) {
  const parts = []
  if (summary.group) parts.push(`${summary.group} grupos`)
  if (summary.knockout) parts.push(`${summary.knockout} elim.`)
  if (summary.inicioKnockout) parts.push(`${summary.inicioKnockout} bracket`)
  if (summary.bonuses) parts.push(`${summary.bonuses} especiales`)
  return parts.length ? parts.join(' · ') : 'Sin predicciones'
}

/** Cuántas predicciones del origen rellenarían huecos en el destino. */
export function countMergeableGaps(targetRaw, sourceRaw) {
  const target = normalizePredictions(targetRaw)
  const source = normalizePredictions(sourceRaw)
  let gaps = 0

  for (const [id, src] of Object.entries(source.group || {})) {
    if (isGroupPredFilled(src) && !isGroupPredFilled(target.group[id])) gaps += 1
  }
  for (const [id, src] of Object.entries(source.knockout || {})) {
    if (isKoPredFilled(src) && !isKoPredFilled(target.knockout[id])) gaps += 1
  }
  for (const [id, src] of Object.entries(source.inicioKnockout || {})) {
    if (isKoPredFilled(src) && !isKoPredFilled(target.inicioKnockout[id])) gaps += 1
  }
  for (const key of Object.keys(EMPTY_BONUSES)) {
    const cur = (target.bonuses[key] || '').trim()
    const src = (source.bonuses[key] || '').trim()
    if (!cur && src) gaps += 1
  }
  return gaps
}
