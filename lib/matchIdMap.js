import { toCanonicalTeamName } from './teamNamesEs.js'

/** Clave estable para emparejar partidos legacy con IDs de la API */
export function matchFingerprint(m) {
  const g = m.group || ''
  const h = toCanonicalTeamName(m.home || m.homeTeam || '')
  const a = toCanonicalTeamName(m.away || m.awayTeam || '')
  const d = m.utcDate ? new Date(m.utcDate).toISOString().slice(0, 10) : ''
  return `${g}|${h}|${a}|${d}`
}

export function buildMatchIdIndex(matches) {
  const byFp = new Map()
  const byId = new Map()
  for (const m of matches || []) {
    if (!m?.id) continue
    byId.set(String(m.id), m)
    byFp.set(matchFingerprint(m), String(m.id))
  }
  return { byFp, byId, ids: new Set(byId.keys()) }
}

/** Reindexa { [id]: pred } al ID canónico del calendario API */
export function migratePredictionMap(preds = {}, canonicalMatches = []) {
  if (!canonicalMatches.length) return { migrated: { ...preds }, orphans: [], moved: 0 }

  const { byFp, ids } = buildMatchIdIndex(canonicalMatches)
  const migrated = {}
  const orphans = []

  for (const [key, pred] of Object.entries(preds)) {
    if (ids.has(String(key))) {
      migrated[key] = pred
      continue
    }
    const fp = pred?._fp || key
    const canon = byFp.get(fp)
    if (canon) {
      migrated[canon] = { ...pred }
      delete migrated[canon]._fp
      continue
    }
    if (pred?.homeTeam && pred?.awayTeam) {
      const guess = byFp.get(matchFingerprint({
        home: pred.homeTeam,
        away: pred.awayTeam,
        group: '',
      }))
      if (guess) {
        migrated[guess] = { home: pred.home, away: pred.away }
        continue
      }
    }
    orphans.push(key)
    migrated[key] = pred
  }

  const moved = Object.keys(migrated).filter(k => ids.has(k) && !preds[k]).length
  return { migrated, orphans, moved }
}

export function attachFingerprintsToMatches(matches) {
  return (matches || []).map(m => ({ ...m, _fp: matchFingerprint(m) }))
}

export function countOrphanPredKeys(preds, canonicalMatches) {
  const { ids } = buildMatchIdIndex(canonicalMatches)
  return Object.keys(preds || {}).filter(k => !ids.has(String(k))).length
}
