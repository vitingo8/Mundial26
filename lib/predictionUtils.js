import {
  calcMatchPoints,
  calcMatchPointsSplit,
  calcBonusPoints,
  calcParticipantScoreColumns,
  SCORING,
  PHASE_WEIGHT,
} from './gameData'
import { isInicioKoId } from './matchPointsDisplay.js'
import { buildEliminatoriasKnockoutSchedule } from './knockoutBridge.js'
import {
  buildKnockoutScoringContext,
  resolveKnockoutResult,
  resolveKnockoutTeamsForScoring,
} from './knockoutMatchScoring.js'

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

function phaseWeight(phase) {
  if (phase === 'knockout') return PHASE_WEIGHT.knockoutReal
  if (phase === 'inicio' || phase === 'group') return PHASE_WEIGHT.inicio
  return 1
}

function phasePts(raw, phase) {
  const weight = phaseWeight(phase)
  return {
    raw,
    weighted: Math.round(raw * weight * 10) / 10,
    phase,
    weight,
  }
}

export function buildPointsBreakdown(user, group, groupMatches = [], knockoutMatches = []) {
  const preds = user?.predictions || {}
  const results = group?.results || { group: {}, knockout: {} }
  const koCtx = buildKnockoutScoringContext(user, {
    groupMatches,
    knockoutMatches,
    koPreds: preds.knockout,
  })
  const elimSchedule = buildEliminatoriasKnockoutSchedule(knockoutMatches, preds.knockout)
  const items = []

  function addMatch(m, pred, res, phase, matchOpts = {}) {
    if (!pred || res?.home == null || res?.away == null) return
    const split = calcMatchPointsSplit(pred, res, matchOpts)
    const raw = split.gep + split.resultado + split.advance
    const exact = split.resultado > 0
    const outcome = split.gep > 0
    const w = phasePts(raw, phase)
    const parts = []
    if (outcome) parts.push(`+${SCORING.correctOutcome} (1X2)`)
    if (exact) parts.push(`+${SCORING.exactScore} exacto`)
    if (split.advance > 0) parts.push(`+${SCORING.knockoutAdvance} quien pasa`)
    const weightLabel = w.weight < 1 ? ` ×${w.weight}` : ''
    items.push({
      id: m.id,
      phase,
      label: m.label || `${m.home} vs ${m.away}`,
      pred: `${pred.home}-${pred.away}${pred.advances ? ` (${pred.advances === 'home' ? m.home : m.away} pasa)` : ''}`,
      real: `${res.home}-${res.away}`,
      pts: raw,
      weightedPts: w.weighted,
      factor: w.weight,
      hit: raw > 0,
      detail: raw === 0 ? 'Sin puntos' : `${parts.join(' · ')}${weightLabel}`,
    })
  }

  groupMatches.forEach(m => addMatch(m, preds.group?.[m.id], results.group?.[m.id], 'inicio'))
  Object.entries(preds.inicioKnockout || {}).forEach(([id, pred]) => {
    const res = results.knockout?.[id]
    if (!isInicioKoId(id)) return
    addMatch(
      { id, label: `KO previsto ${id.replace(/^inicio-ko-/, 'P')}` },
      pred,
      res,
      'inicio',
      { knockout: true },
    )
  })
  elimSchedule.forEach(m => {
    const pred = preds.knockout?.[m.id]
    const res = resolveKnockoutResult(m.id, results.knockout, koCtx)
    if (!pred || res?.home == null || res?.away == null) return
    const { predictedTeams, actualTeams } = resolveKnockoutTeamsForScoring(m.id, res, koCtx)
    addMatch(m, pred, res, 'knockout', {
      knockout: true,
      predictedTeams,
      actualTeams,
    })
  })

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

export function enrichLeaderboardWithStats(leaderboard, group, scoringOpts = {}) {
  return leaderboard.map((p, index) => {
    const cols = group ? calcParticipantScoreColumns(p, group, scoringOpts) : {
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
    badges.push({ type: 'info', text: 'Inicio/Especiales: 11 jun 2026, 21:00 (Madrid)' })
  }
  if (!group.knockout_deadline) {
    badges.push({ type: 'info', text: 'Eliminatorias: 28 jun 2026, 21:00 (Madrid)' })
  }
  const bonusMissing = ['topScorer', 'topKeeper', 'topAssists', 'mvp'].filter(
    k => !group.actuals?.[k]
  ).length
  if (bonusMissing > 0) {
    badges.push({ type: 'info', text: `Ganadores reales: ${4 - bonusMissing}/4` })
  }
  return badges
}
