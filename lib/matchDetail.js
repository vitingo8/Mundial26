const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])

export function isLiveMatchStatus(status) {
  return LIVE_STATUSES.has(status)
}

/** Marcador principal para cabecera del detalle. */
export function getMatchDetailScore(match) {
  if (!match?.score) return null
  const ft = match.score.fullTime
  if (ft?.home != null && ft?.away != null) {
    return { home: ft.home, away: ft.away, label: null }
  }
  if (isLiveMatchStatus(match.status)) {
    const ht = match.score.halfTime
    if (ht?.home != null && ht?.away != null) {
      return { home: ht.home, away: ht.away, label: 'Descanso' }
    }
  }
  const lastGoal = match.goals?.[match.goals.length - 1]
  if (lastGoal?.score?.home != null && lastGoal?.score?.away != null) {
    return { home: lastGoal.score.home, away: lastGoal.score.away, label: null }
  }
  return null
}

function eventSortKey(minute, injuryTime) {
  const m = minute ?? 0
  const extra = injuryTime ?? 0
  return m * 100 + extra
}

/** Cronología unificada: goles, tarjetas y cambios. */
export function buildMatchTimeline(match) {
  const items = []

  for (const g of match?.goals || []) {
    items.push({
      kind: 'goal',
      minute: g.minute,
      injuryTime: g.injuryTime,
      sortKey: eventSortKey(g.minute, g.injuryTime),
      teamName: g.team?.name,
      playerName: g.scorer?.name,
      assistName: g.assist?.name,
      type: g.type,
      score: g.score,
    })
  }

  for (const b of match?.bookings || []) {
    items.push({
      kind: 'card',
      minute: b.minute,
      injuryTime: null,
      sortKey: eventSortKey(b.minute, 0),
      teamName: b.team?.name,
      playerName: b.player?.name,
      card: b.card,
    })
  }

  for (const s of match?.substitutions || []) {
    items.push({
      kind: 'sub',
      minute: s.minute,
      injuryTime: null,
      sortKey: eventSortKey(s.minute, 0),
      teamName: s.team?.name,
      playerOut: s.playerOut?.name,
      playerIn: s.playerIn?.name,
    })
  }

  items.sort((a, b) => a.sortKey - b.sortKey)
  return items
}

export function formatEventMinute(minute, injuryTime) {
  if (minute == null) return '—'
  if (injuryTime) return `${minute}+${injuryTime}'`
  return `${minute}'`
}

const GOAL_TYPE_LABELS = {
  REGULAR: 'Gol',
  PENALTY: 'Penalti',
  OWN: 'Autogol',
}

export function goalTypeLabel(type) {
  return GOAL_TYPE_LABELS[type] || 'Gol'
}

const STAT_LABELS = {
  ball_possession: 'Posesión %',
  shots: 'Tiros',
  shots_on_goal: 'A puerta',
  shots_off_goal: 'Fuera',
  corners: 'Córners',
  corner_kicks: 'Córners',
  fouls: 'Faltas',
  offsides: 'Fuera de juego',
  yellow_cards: 'Amarillas',
  red_cards: 'Rojas',
  saves: 'Paradas',
  free_kicks: 'Faltas a favor',
  goal_kicks: 'Saques de puerta',
  throw_ins: 'Saques de banda',
}

export function pickTeamStatistics(stats) {
  if (!stats || typeof stats !== 'object') return []
  return Object.entries(stats)
    .filter(([, v]) => v != null && v !== '')
    .map(([key, value]) => ({
      key,
      label: STAT_LABELS[key] || key.replace(/_/g, ' '),
      value,
    }))
    .slice(0, 8)
}
