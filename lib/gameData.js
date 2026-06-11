import { GROUPS_DATA_2026, PROVISIONAL_TEAMS_NOTE } from './groups2026.js'

export { PROVISIONAL_TEAMS_NOTE }

export const GROUPS_DATA = GROUPS_DATA_2026
export const ALL_TEAMS = [...new Set(Object.values(GROUPS_DATA).flat())].sort((a, b) =>
  a.localeCompare(b, 'es')
)

export const KNOCKOUT_ROUNDS = [
  { id: 'r32', label: 'Ronda de 32', icon: 'bolt', matches: 16 },
  { id: 'r16', label: 'Octavos de Final', icon: 'fire', matches: 8 },
  { id: 'qf', label: 'Cuartos de Final', icon: 'sparkles', matches: 4 },
  { id: 'sf', label: 'Semifinales', icon: 'star', matches: 2 },
  { id: '3rd', label: '3er y 4to Puesto', icon: 'trophy', matches: 1 },
  { id: 'final', label: 'Final', icon: 'trophy', matches: 1 },
]

import { calcKnockoutAdvanceBonus } from './knockoutAdvances.js'
import {
  buildKnockoutScoringContext,
  knockoutMatchupMatches,
  resolveKnockoutResult,
  resolveKnockoutTeamsForScoring,
} from './knockoutMatchScoring.js'
import { calcGroupQualificationPoints } from './groupQualificationScoring.js'
import { migrateParticipantPredictions } from './matchIdMap.js'

export const SCORING = {
  correctOutcome: 3, // 1X2 (local / empate / visitante) en grupos y eliminatorias
  exactScore: 5, // bonus por marcador exacto (suma al acertar 1X2)
  knockoutAdvance: 1, // acierto de quién pasa (eliminatorias)
  groupQualifies: 1, // clasifica a dieciseisavos (vs API)
  groupQualExactPosition: 1, // además acierta 1.º / 2.º / 3.º en su grupo
  topScorer: 6,
  topKeeper: 6, // mejor portero del torneo
  topAssists: 6,
  mvp: 10,
}

/** Peso en el total: pestaña Inicio (grupos + KO previsto) vs eliminatorias reales (API). */
export const PHASE_WEIGHT = {
  inicio: 0.6,
  knockoutReal: 0.4,
}

function roundPts(n) {
  return Math.round(n * 10) / 10
}

function isInicioKoPredId(id) {
  const s = String(id)
  return s.startsWith('inicio-ko-') || s.startsWith('inicio-r32-')
}

export function generateGroupMatches(groupsData = GROUPS_DATA) {
  const matches = []
  Object.entries(groupsData).forEach(([grp, teams]) => {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `${grp}-${i}-${j}`,
          group: grp,
          home: teams[i],
          away: teams[j],
        })
      }
    }
  })
  return matches
}

export function getOutcome(h, a) {
  if (h > a) return 'H'
  if (h < a) return 'A'
  return 'D'
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.knockout] — eliminatorias
 * @param {{ home?: string, away?: string }} [opts.predictedTeams] — cruce de tu porra (bracket Inicio)
 * @param {{ home?: string, away?: string }} [opts.actualTeams] — cruce real del partido
 */
export function calcMatchPointsSplit(prediction, result, opts = {}) {
  if (!prediction || result?.home == null || result?.away == null) {
    return { gep: 0, resultado: 0, advance: 0 }
  }

  const { predictedTeams, actualTeams } = opts
  let matchupOk = true
  if (opts.knockout) {
    const hasPredicted = !!(predictedTeams?.home && predictedTeams?.away)
    const hasActual = !!(actualTeams?.home && actualTeams?.away)
    if (hasPredicted && hasActual) {
      matchupOk = knockoutMatchupMatches(predictedTeams, actualTeams)
    } else if (hasActual) {
      matchupOk = false
    } else {
      matchupOk = !hasPredicted
    }
  }

  const outcomeOk =
    matchupOk &&
    getOutcome(prediction.home, prediction.away) === getOutcome(result.home, result.away)
  const exact =
    matchupOk &&
    prediction.home === result.home &&
    prediction.away === result.away
  const advance = opts.knockout
    ? calcKnockoutAdvanceBonus(prediction, result, { predictedTeams, actualTeams }) *
      SCORING.knockoutAdvance
    : 0
  return {
    gep: outcomeOk ? SCORING.correctOutcome : 0,
    resultado: exact ? SCORING.exactScore : 0,
    advance,
  }
}

export function calcMatchPoints(prediction, result, opts = {}) {
  const { gep, resultado, advance } = calcMatchPointsSplit(prediction, result, opts)
  return gep + resultado + advance
}

const ESPECIAL_FIELDS = ['topScorer', 'topKeeper', 'topAssists']

export function calcBonusPointsSplit(predictions, actuals) {
  let especial = 0
  let mvp = 0
  ESPECIAL_FIELDS.forEach(f => {
    if (
      predictions?.[f] &&
      actuals?.[f] &&
      predictions[f].trim().toLowerCase() === actuals[f].trim().toLowerCase()
    ) {
      especial += SCORING[f] || 0
    }
  })
  if (
    predictions?.mvp &&
    actuals?.mvp &&
    predictions.mvp.trim().toLowerCase() === actuals.mvp.trim().toLowerCase()
  ) {
    mvp += SCORING.mvp || 0
  }
  return { especial, mvp }
}

export function calcBonusPoints(predictions, actuals) {
  const { especial, mvp } = calcBonusPointsSplit(predictions, actuals)
  return especial + mvp
}

/** Columnas tabla: G/E/P, Resultado, Especial, MVP (partidos ponderados 60/40). */
export function calcParticipantScoreColumns(participant, group, scoringOpts = {}) {
  const raw = participant?.predictions || {}
  const { groupMatches = [], knockoutMatches = [] } = scoringOpts
  const preds = migrateParticipantPredictions(raw, groupMatches, knockoutMatches)
  const koCtx = buildKnockoutScoringContext(participant, scoringOpts)
  const results = group?.results || { group: {}, knockout: {} }

  const inicio = { gep: 0, resultado: 0, advance: 0 }
  const knockoutReal = { gep: 0, resultado: 0, advance: 0 }

  function addTo(bucket, split) {
    bucket.gep += split.gep
    bucket.resultado += split.resultado
    bucket.advance += split.advance
  }

  Object.entries(preds.group || {}).forEach(([id, pred]) => {
    const res = results.group?.[id]
    if (!pred || res?.home == null || res?.away == null) return
    addTo(inicio, calcMatchPointsSplit(pred, res))
  })

  Object.entries(preds.inicioKnockout || {}).forEach(([id, pred]) => {
    const res = results.knockout?.[id]
    if (!pred || res?.home == null || res?.away == null) return
    addTo(inicio, calcMatchPointsSplit(pred, res, { knockout: true }))
  })

  Object.entries(preds.knockout || {}).forEach(([id, pred]) => {
    if (isInicioKoPredId(id)) return
    const res = resolveKnockoutResult(id, results.knockout, koCtx)
    if (!pred || res?.home == null || res?.away == null) return
    const { predictedTeams, actualTeams } = resolveKnockoutTeamsForScoring(id, res, koCtx)
    addTo(
      knockoutReal,
      calcMatchPointsSplit(pred, res, { knockout: true, predictedTeams, actualTeams }),
    )
  })

  const qualification = calcGroupQualificationPoints(participant, scoringOpts)

  const inicioRaw =
    inicio.gep + inicio.resultado + inicio.advance + qualification.total
  const knockoutRaw =
    knockoutReal.gep + knockoutReal.resultado + knockoutReal.advance

  const inicioWeighted = roundPts(inicioRaw * PHASE_WEIGHT.inicio)
  const qualificationWeighted = roundPts(qualification.total * PHASE_WEIGHT.inicio)
  const knockoutWeighted = roundPts(knockoutRaw * PHASE_WEIGHT.knockoutReal)

  const { especial, mvp } = calcBonusPointsSplit(preds.bonuses, group.actuals)
  const bonusPts = especial + mvp

  const inicioGepPts = roundPts(inicio.gep * PHASE_WEIGHT.inicio)
  const inicioResultadoPts = roundPts(inicio.resultado * PHASE_WEIGHT.inicio)
  const inicioAdvancePts = roundPts(inicio.advance * PHASE_WEIGHT.inicio)
  const inicioClasPasaPts = roundPts(inicioAdvancePts + qualificationWeighted)
  const knockoutGepPts = roundPts(knockoutReal.gep * PHASE_WEIGHT.knockoutReal)
  const knockoutResultadoPts = roundPts(knockoutReal.resultado * PHASE_WEIGHT.knockoutReal)
  const knockoutAdvancePts = roundPts(knockoutReal.advance * PHASE_WEIGHT.knockoutReal)

  const gepPts = roundPts(inicioGepPts + knockoutGepPts)
  const resultadoPts = roundPts(inicioResultadoPts + knockoutResultadoPts)
  const advancePts = roundPts(inicioAdvancePts + knockoutAdvancePts)

  const total = roundPts(inicioWeighted + knockoutWeighted + bonusPts)

  return {
    gepPts,
    resultadoPts,
    advancePts,
    inicioGepPts,
    inicioResultadoPts,
    inicioAdvancePts,
    inicioClasPasaPts,
    knockoutGepPts,
    knockoutResultadoPts,
    knockoutAdvancePts,
    qualificationPts: qualification.total,
    qualificationWeighted,
    inicioPts: inicioWeighted,
    knockoutPts: knockoutWeighted,
    inicioRawPts: roundPts(inicioRaw),
    knockoutRawPts: roundPts(knockoutRaw),
    bonusPts: roundPts(bonusPts),
    especialPts: especial,
    mvpPts: mvp,
    total,
    qualificationReady: qualification.ready,
    qualificationResolved: qualification.resolvedCount ?? 0,
  }
}

export function calcLeaderboard(group, scoringOpts = {}) {
  if (!group?.participants) return []
  return Object.values(group.participants)
    .map(p => {
      const cols = calcParticipantScoreColumns(p, group, scoringOpts)
      return { ...p, ...cols }
    })
    .sort(leaderboardTiebreak)
}

/** Desempate: total → G/E/P → Resultado → updated_at (más antiguo gana) */
export function leaderboardTiebreak(a, b) {
  if (b.total !== a.total) return b.total - a.total
  if ((b.gepPts ?? 0) !== (a.gepPts ?? 0)) return (b.gepPts ?? 0) - (a.gepPts ?? 0)
  if ((b.resultadoPts ?? 0) !== (a.resultadoPts ?? 0)) return (b.resultadoPts ?? 0) - (a.resultadoPts ?? 0)
  const ta = new Date(a.updated_at || 0).getTime()
  const tb = new Date(b.updated_at || 0).getTime()
  return ta - tb
}

export function uid() {
  return Math.random().toString(36).slice(2, 9)
}

export function isDeadlinePassed(deadline) {
  if (!deadline) return false
  return new Date() > new Date(deadline)
}
