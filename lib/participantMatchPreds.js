import { migrateParticipantPredictions } from './matchIdMap.js'
import { normalizeInicioKoPreds } from './knockoutBridge.js'
import { resolveKnockoutAdvanceSide } from './knockoutAdvances.js'

/** Predicciones de todos los participantes para un partido concreto. */
export function getParticipantPredsForMatch(
  participants,
  matchId,
  { groupMatches = [], knockoutMatches = [], match = null } = {},
) {
  const rows = []
  const matchKey = String(matchId)

  for (const p of Object.values(participants || {})) {
    const raw = p.predictions || {}
    const migrated = migrateParticipantPredictions(raw, groupMatches, knockoutMatches)
    const inicioKo = normalizeInicioKoPreds(raw.inicioKnockout || {})
    const koPred = migrated.knockout?.[matchKey]
    const pred =
      migrated.group?.[matchKey]
      ?? inicioKo?.[matchKey]
      ?? koPred
    if (pred?.home == null && pred?.away == null) continue
    const label = (p.team_name || p.name || '').trim() || 'Participante'
    const advanceSide = koPred ? resolveKnockoutAdvanceSide(koPred) : null
    const row = {
      id: p.id,
      label,
      home: pred.home,
      away: pred.away,
    }
    if (advanceSide && match) {
      row.advanceSide = advanceSide
      row.advanceName = advanceSide === 'home' ? match.home : match.away
      row.advanceCrest = advanceSide === 'home' ? match.homeCrest : match.awayCrest
    }
    rows.push(row)
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))
  return rows
}
