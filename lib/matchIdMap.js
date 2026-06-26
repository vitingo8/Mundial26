import legacyFootballDataIds from './legacyFootballDataIds.json' with { type: 'json' }
import groupStageCatalog from './fifaMatchCatalog/groupStage.json' with { type: 'json' }
import { FIFA_MATCH_COUNT } from './fifaMatchNumbers.js'
import { toCanonicalTeamName } from './teamNamesEs.js'

function normalizeGroupLetter(group) {
  return String(group || '').replace(/^GROUP_/i, '')
}

function teamNamesFromMatch(m) {
  return {
    home: toCanonicalTeamName(
      m.home || m.homeTeam?.shortName || m.homeTeam?.name || '',
    ),
    away: toCanonicalTeamName(
      m.away || m.awayTeam?.shortName || m.awayTeam?.name || '',
    ),
  }
}

/** Huella por grupo + equipos (sin fecha; tolera desfases FotMob vs catálogo FIFA). */
export function matchTeamFingerprint(m) {
  const g = normalizeGroupLetter(m.group)
  const { home, away } = teamNamesFromMatch(m)
  return `${g}|${home}|${away}`
}

/** Clave estable para emparejar partidos legacy con IDs de la API */
export function matchFingerprint(m) {
  const g = normalizeGroupLetter(m.group)
  const { home, away } = teamNamesFromMatch(m)
  const d = m.utcDate ? new Date(m.utcDate).toISOString().slice(0, 10) : ''
  return `${g}|${home}|${away}|${d}`
}

export function buildMatchIdIndex(matches) {
  const byFp = new Map()
  const byTeamFp = new Map()
  const byId = new Map()
  const byMatchNumber = new Map()
  for (const m of matches || []) {
    if (!m?.id) continue
    const id = String(m.id)
    byId.set(id, m)
    byFp.set(matchFingerprint(m), id)
    byTeamFp.set(matchTeamFingerprint(m), id)
    if (m.matchNumber != null) byMatchNumber.set(Number(m.matchNumber), id)
  }
  return { byFp, byTeamFp, byId, ids: new Set(byId.keys()), byMatchNumber }
}

function catalogRow(matchNumber) {
  return groupStageCatalog.find(r => r.n === Number(matchNumber)) || null
}

function catalogFingerprint(matchNumber) {
  const row = catalogRow(matchNumber)
  if (!row) return null
  return matchFingerprint({
    group: row.g,
    home: row.home,
    away: row.away,
    utcDate: row.utcDate,
  })
}

function catalogTeamFingerprint(matchNumber) {
  const row = catalogRow(matchNumber)
  if (!row) return null
  return matchTeamFingerprint({ group: row.g, home: row.home, away: row.away })
}

function resolveByMatchNumber(matchNumber, byMatchNumber, byFp, byTeamFp) {
  const direct = byMatchNumber.get(Number(matchNumber))
  if (direct) return direct

  const fp = catalogFingerprint(matchNumber)
  if (fp) {
    const viaCatalog = byFp.get(fp)
    if (viaCatalog) return viaCatalog
  }

  const teamFp = catalogTeamFingerprint(matchNumber)
  if (teamFp) {
    const viaTeams = byTeamFp.get(teamFp)
    if (viaTeams) return viaTeams
  }

  return null
}

function parseAlternateMatchKey(key) {
  const s = String(key)
  const catalog = /^catalog-(\d+)$/.exec(s)
  if (catalog) return Number(catalog[1])

  if (/^\d+$/.test(s) && legacyFootballDataIds[s] == null) {
    const n = Number(s)
    if (n >= 1 && n <= FIFA_MATCH_COUNT) return n
  }

  return null
}

function resolveLegacyFootballDataId(key, byMatchNumber, byFp, byTeamFp) {
  const matchNumber = legacyFootballDataIds[String(key)]
  if (matchNumber == null) return null
  return resolveByMatchNumber(matchNumber, byMatchNumber, byFp, byTeamFp)
}

/** Reindexa { [id]: pred } al ID canónico del calendario actual (FotMob / catálogo). */
export function migratePredictionMap(preds = {}, canonicalMatches = []) {
  if (!canonicalMatches.length) return { migrated: { ...preds }, orphans: [], moved: 0 }

  const { byFp, byTeamFp, ids, byMatchNumber } = buildMatchIdIndex(canonicalMatches)
  const migrated = {}
  const orphans = []
  let moved = 0

  for (const [key, pred] of Object.entries(preds)) {
    if (ids.has(String(key))) {
      migrated[key] = pred
      continue
    }

    const legacyCanon = resolveLegacyFootballDataId(key, byMatchNumber, byFp, byTeamFp)
    if (legacyCanon) {
      migrated[legacyCanon] = { ...pred }
      delete migrated[legacyCanon]._fp
      moved += 1
      continue
    }

    const altMatchNumber = parseAlternateMatchKey(key)
    if (altMatchNumber != null) {
      const altCanon = resolveByMatchNumber(altMatchNumber, byMatchNumber, byFp, byTeamFp)
      if (altCanon) {
        migrated[altCanon] = { ...pred }
        delete migrated[altCanon]._fp
        moved += 1
        continue
      }
    }

    const fp = pred?._fp || key
    const canon = byFp.get(fp) || byTeamFp.get(fp)
    if (canon) {
      migrated[canon] = { ...pred }
      delete migrated[canon]._fp
      if (!preds[canon]) moved += 1
      continue
    }

    if (pred?.homeTeam && pred?.awayTeam) {
      const guess =
        byFp.get(matchFingerprint({
          home: pred.homeTeam,
          away: pred.awayTeam,
          group: pred.group || '',
        }))
        || byTeamFp.get(matchTeamFingerprint({
          home: pred.homeTeam,
          away: pred.awayTeam,
          group: pred.group || '',
        }))
      if (guess) {
        migrated[guess] = { ...(migrated[guess] || {}), ...pred }
        delete migrated[guess]._fp
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

/** Resultados publicados con IDs legacy → calendario actual (misma lógica que predicciones). */
export function migrateGroupResults(results = {}, groupMatches = [], knockoutMatches = []) {
  return {
    group: migratePredictionMap(results.group || {}, groupMatches).migrated,
    knockout: migratePredictionMap(results.knockout || {}, knockoutMatches).migrated,
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
