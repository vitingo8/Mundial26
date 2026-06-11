import legacyFootballDataIds from './legacyFootballDataIds.json' with { type: 'json' }
import groupStageCatalog from './fifaMatchCatalog/groupStage.json' with { type: 'json' }
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
  const byMatchNumber = new Map()
  for (const m of matches || []) {
    if (!m?.id) continue
    const id = String(m.id)
    byId.set(id, m)
    byFp.set(matchFingerprint(m), id)
    if (m.matchNumber != null) byMatchNumber.set(Number(m.matchNumber), id)
  }
  return { byFp, byId, ids: new Set(byId.keys()), byMatchNumber }
}

function catalogFingerprint(matchNumber) {
  const row = groupStageCatalog.find(r => r.n === Number(matchNumber))
  if (!row) return null
  return matchFingerprint({
    group: row.g,
    home: row.home,
    away: row.away,
    utcDate: row.utcDate,
  })
}

function resolveLegacyFootballDataId(key, byMatchNumber, byFp) {
  const matchNumber = legacyFootballDataIds[String(key)]
  if (matchNumber == null) return null

  const direct = byMatchNumber.get(Number(matchNumber))
  if (direct) return direct

  const fp = catalogFingerprint(matchNumber)
  if (fp) {
    const viaCatalog = byFp.get(fp)
    if (viaCatalog) return viaCatalog
  }

  return null
}

/** Reindexa { [id]: pred } al ID canónico del calendario actual (FotMob / catálogo). */
export function migratePredictionMap(preds = {}, canonicalMatches = []) {
  if (!canonicalMatches.length) return { migrated: { ...preds }, orphans: [], moved: 0 }

  const { byFp, ids, byMatchNumber } = buildMatchIdIndex(canonicalMatches)
  const migrated = {}
  const orphans = []
  let moved = 0

  for (const [key, pred] of Object.entries(preds)) {
    if (ids.has(String(key))) {
      migrated[key] = pred
      continue
    }

    const legacyCanon = resolveLegacyFootballDataId(key, byMatchNumber, byFp)
    if (legacyCanon) {
      migrated[legacyCanon] = { ...pred }
      delete migrated[legacyCanon]._fp
      moved += 1
      continue
    }

    const fp = pred?._fp || key
    const canon = byFp.get(fp)
    if (canon) {
      migrated[canon] = { ...pred }
      delete migrated[canon]._fp
      if (!preds[canon]) moved += 1
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
        if (!preds[guess]) moved += 1
        continue
      }
    }

    orphans.push(key)
    migrated[key] = pred
  }

  return { migrated, orphans, moved }
}

export function migrateParticipantPredictions(raw = {}, groupMatches = [], knockoutMatches = []) {
  return {
    ...raw,
    group: migratePredictionMap(raw.group || {}, groupMatches).migrated,
    knockout: migratePredictionMap(raw.knockout || {}, knockoutMatches).migrated,
  }
}

export function attachFingerprintsToMatches(matches) {
  return (matches || []).map(m => ({ ...m, _fp: matchFingerprint(m) }))
}

export function countOrphanPredKeys(preds, canonicalMatches) {
  if (!canonicalMatches.length) return 0
  const { orphans } = migratePredictionMap(preds, canonicalMatches)
  return orphans.length
}
