import { migrateParticipantPredictions } from './matchIdMap.js'
import { normalizeInicioKoPreds } from './knockoutBridge.js'

/** Predicciones de todos los participantes para un partido concreto. */
export function getParticipantPredsForMatch(
  participants,
  matchId,
  { groupMatches = [], knockoutMatches = [] } = {},
) {
  const rows = []
  const matchKey = String(matchId)

  for (const p of Object.values(participants || {})) {
    const raw = p.predictions || {}
    const migrated = migrateParticipantPredictions(raw, groupMatches, knockoutMatches)
    const inicioKo = normalizeInicioKoPreds(raw.inicioKnockout || {})
    const pred =
      migrated.group?.[matchKey]
      ?? inicioKo?.[matchKey]
      ?? migrated.knockout?.[matchKey]
    if (pred?.home == null && pred?.away == null) continue
    const label = (p.team_name || p.name || '').trim() || 'Participante'
    rows.push({
      id: p.id,
      label,
      home: pred.home,
      away: pred.away,
    })
  }
  rows.sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))
  return rows
}
