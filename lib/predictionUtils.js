import {
  calcMatchPoints,
  calcMatchPointsSplit,
  calcBonusPoints,
  calcParticipantScoreColumns,
  SCORING,
} from './gameData'

export function isScoreFilled(val) {
  return val !== '' && val != null && !Number.isNaN(Number(val))
}

export function isGroupPredFilled(pred) {
  return pred && isScoreFilled(pred.home) && isScoreFilled(pred.away)
}

export function countFilledMatches(preds, matches) {
  if (!matches?.length) {
    return Object.values(preds || {}).filter(isGroupPredFilled).length
  }
  return matches.filter(m => isGroupPredFilled(preds?.[m.id])).length
}

export function getUniqueTeamsFromMatches(groupMatches, knockoutMatches) {
  const set = new Set()
  ;[...(groupMatches || []), ...(knockoutMatches || [])].forEach(m => {
    if (m.home) set.add(m.home)
    if (m.away) set.add(m.away)
    if (m.homeTeam) set.add(m.homeTeam)
    if (m.awayTeam) set.add(m.awayTeam)
  })
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
}

function phasePts(raw, phase) {
  return { raw, weighted: raw, phase }
}

export function buildPointsBreakdown(user, group, groupMatches = [], knockoutMatches = []) {
  const preds = user?.predictions || {}
  const results = group?.results || { group: {}, knockout: {} }
  const items = []

  function addMatch(m, pred, res, phase, knockout = false) {
    if (!pred || res?.home == null || res?.away == null) return
    const split = calcMatchPointsSplit(pred, res, { knockout })
    const raw = split.gep + split.resultado + split.advance
    const exact = split.resultado > 0
    const outcome = split.gep > 0
    const w = phasePts(raw, phase)
    const parts = []
    if (outcome) parts.push(`+${SCORING.correctOutcome} (1X2)`)
    if (exact) parts.push(`+${SCORING.exactScore} exacto`)
    if (split.advance > 0) parts.push(`+${SCORING.knockoutAdvance} quien pasa`)
    items.push({
      id: m.id,
      phase,
      label: `${m.home} vs ${m.away}`,
      pred: `${pred.home}-${pred.away}${pred.advances ? ` (${pred.advances === 'home' ? m.home : m.away} pasa)` : ''}`,
      real: `${res.home}-${res.away}`,
      pts: raw,
      weightedPts: w.weighted,
      factor: 1,
      hit: raw > 0,
      detail: raw === 0 ? 'Sin puntos' : parts.join(' · '),
    })
  }

  groupMatches.forEach(m => addMatch(m, preds.group?.[m.id], results.group?.[m.id], 'group'))
  knockoutMatches.forEach(m =>
    addMatch(m, preds.knockout?.[m.id], results.knockout?.[m.id], 'knockout', true),
  )

  const bonusFields = [
    { id: 'topScorer', label: 'Máximo goleador' },
    { id: 'topKeeper', label: 'Portero menos goleado' },
    { id: 'topAssists', label: 'Máximo asistente' },
    { id: 'mvp', label: 'MVP' },
  ]
  bonusFields.forEach(f => {
    const p = preds.bonuses?.[f.id]
    const a = group?.actuals?.[f.id]
    const hit = p && a && p.trim().toLowerCase() === a.trim().toLowerCase()
    if (p && a) {
      items.push({
        id: f.id,
        phase: 'bonus',
        label: f.label,
        pred: p,
        real: a,
        pts: hit ? SCORING[f.id] || 0 : 0,
        weightedPts: hit ? SCORING[f.id] || 0 : 0,
        factor: 1,
        hit,
        detail: hit ? 'Acierto' : 'No coincide',
      })
    }
  })

  return items
}

export function enrichLeaderboardWithStats(leaderboard, group) {
  return leaderboard.map((p, index) => {
    const cols = group ? calcParticipantScoreColumns(p, group) : {
      gepPts: p.gepPts ?? 0,
      resultadoPts: p.resultadoPts ?? 0,
      especialPts: p.especialPts ?? 0,
      mvpPts: p.mvpPts ?? 0,
      total: p.total ?? 0,
    }
    return { ...p, ...cols, rank: index + 1 }
  })
}

export function hasAnyPublishedResults(group) {
  const g = Object.keys(group?.results?.group || {}).length
  const k = Object.keys(group?.results?.knockout || {}).length
  const b = Object.keys(group?.actuals || {}).filter(k => group.actuals[k]).length
  return g > 0 || k > 0 || b > 0
}

export function getDefaultPredPhase(groupPhase) {
  if (groupPhase === 'knockout') return 'knockout'
  if (groupPhase === 'finished') return 'bonuses'
  return 'group'
}

export function getAdminTaskBadges(group) {
  const badges = []
  if (!group.group_deadline || !group.bonus_deadline) {
    badges.push({ type: 'info', text: 'Plazos por defecto: 11 jun 2026, 21:00 (Madrid)' })
  }
  const bonusMissing = ['topScorer', 'topKeeper', 'topAssists', 'mvp'].filter(
    k => !group.actuals?.[k]
  ).length
  if (bonusMissing > 0) {
    badges.push({ type: 'info', text: `Ganadores reales: ${4 - bonusMissing}/4` })
  }
  return badges
}
