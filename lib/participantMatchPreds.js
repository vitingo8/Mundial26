/** Predicciones de todos los participantes para un partido concreto. */

export function getParticipantPredsForMatch(participants, matchId) {
  const rows = []
  for (const p of Object.values(participants || {})) {
    const preds = p.predictions || {}
    const pred =
      preds.group?.[matchId]
      ?? preds.inicioKnockout?.[matchId]
      ?? preds.knockout?.[matchId]
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
