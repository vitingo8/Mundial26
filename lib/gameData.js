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

export const SCORING = {
  correctOutcome: 3, // 1X2 (local / empate / visitante) en grupos y eliminatorias
  exactScore: 5, // bonus por marcador exacto (suma al acertar 1X2)
  knockoutAdvance: 1, // empate + acierto de quién pasa (eliminatorias)
  topScorer: 5,
  topKeeper: 5,
  topAssists: 5,
  mvp: 10,
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
 * @param {{ knockout?: boolean }} [opts] — eliminatorias: +1 pt si aciertas quién pasa en empate
 */
export function calcMatchPointsSplit(prediction, result, opts = {}) {
  if (!prediction || result?.home == null || result?.away == null) {
    return { gep: 0, resultado: 0, advance: 0 }
  }
  const outcomeOk =
    getOutcome(prediction.home, prediction.away) === getOutcome(result.home, result.away)
  const exact = prediction.home === result.home && prediction.away === result.away
  const advance = opts.knockout
    ? calcKnockoutAdvanceBonus(prediction, result) * SCORING.knockoutAdvance
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

/** Columnas tabla: G/E/P, Resultado, Especial, MVP */
export function calcParticipantScoreColumns(participant, group) {
  const preds = participant?.predictions || {}
  let gepPts = 0
  let resultadoPts = 0

  let advancePts = 0

  function addMatch(pred, res, knockout = false) {
    const split = calcMatchPointsSplit(pred, res, { knockout })
    gepPts += split.gep
    resultadoPts += split.resultado
    advancePts += split.advance
  }

  Object.entries(preds.group || {}).forEach(([id, pred]) => {
    addMatch(pred, group.results?.group?.[id])
  })
  Object.entries(preds.knockout || {}).forEach(([id, pred]) => {
    addMatch(pred, group.results?.knockout?.[id], true)
  })

  const { especial, mvp } = calcBonusPointsSplit(preds.bonuses, group.actuals)
  const total = gepPts + resultadoPts + advancePts + especial + mvp

  return {
    gepPts,
    resultadoPts,
    advancePts,
    especialPts: especial,
    mvpPts: mvp,
    total: Math.round(total * 10) / 10,
  }
}

export function calcLeaderboard(group) {
  if (!group?.participants) return []
  return Object.values(group.participants)
    .map(p => {
      const cols = calcParticipantScoreColumns(p, group)
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
