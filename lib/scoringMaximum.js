import { SCORING, PHASE_WEIGHT } from './gameData.js'
import { QUALIFICATION_SCORING } from './groupQualificationScoring.js'
import { FIFA_MATCH_COUNT } from './fifaMatchNumbers.js'

/** Partidos de fase de grupos (12 grupos × 6 enfrentamientos). */
export const GROUP_MATCH_COUNT = 72

/** Eliminatorias FIFA 73–104 (dieciseisavos → final). */
export const KNOCKOUT_MATCH_COUNT = FIFA_MATCH_COUNT - GROUP_MATCH_COUNT // 32

/** Clasificados a dieciseisavos (32 plazas). */
export const R32_TEAM_SLOTS = 32

/** Mejores terceros que clasifican. */
export const BEST_THIRD_COUNT = 8

const GROUP_LETTERS_COUNT = 12

function roundPts(n) {
  return Math.round(n * 10) / 10
}

/** Máximo por partido de grupos (1X2 + exacto). */
export function maxGroupMatchRaw() {
  return SCORING.correctOutcome + SCORING.exactScore
}

/** Máximo por partido KO (1X2 + exacto + quién pasa en empate). */
export function maxKnockoutMatchRaw() {
  return SCORING.correctOutcome + SCORING.exactScore + SCORING.knockoutAdvance
}

/** Máximo bonus clasificación: 32 plazas × (clasifica + posición exacta). */
export function maxQualificationRaw() {
  return (
    R32_TEAM_SLOTS * (QUALIFICATION_SCORING.qualifies + QUALIFICATION_SCORING.exactPosition)
  )
}

/** Especiales + MVP (sin ponderar). */
export function maxBonusRaw() {
  return (
    SCORING.topScorer +
    SCORING.topKeeper +
    SCORING.topAssists +
    SCORING.mvp
  )
}

/**
 * Techo teórico si aciertas todo (marcadores, bracket, clasificados, especiales).
 * @param {{ knockoutWithAdvance?: boolean }} [opts] — false: KO sin +1 de empate (8 pts/partido)
 */
export function calcScoringMaximum(opts = {}) {
  const koPerMatch =
    opts.knockoutWithAdvance !== false ? maxKnockoutMatchRaw() : maxGroupMatchRaw()

  const groupRaw = GROUP_MATCH_COUNT * maxGroupMatchRaw()
  const inicioKoRaw = KNOCKOUT_MATCH_COUNT * koPerMatch
  const qualificationRaw = maxQualificationRaw()
  const inicioRaw = groupRaw + inicioKoRaw + qualificationRaw
  const knockoutRealRaw = KNOCKOUT_MATCH_COUNT * koPerMatch
  const bonusRaw = maxBonusRaw()

  const inicioWeighted = roundPts(inicioRaw * PHASE_WEIGHT.inicio)
  const knockoutWeighted = roundPts(knockoutRealRaw * PHASE_WEIGHT.knockoutReal)
  const total = roundPts(inicioWeighted + knockoutWeighted + bonusRaw)

  return {
    counts: {
      groupMatches: GROUP_MATCH_COUNT,
      inicioKnockoutMatches: KNOCKOUT_MATCH_COUNT,
      knockoutRealMatches: KNOCKOUT_MATCH_COUNT,
      qualificationSlots: R32_TEAM_SLOTS,
      bonusFields: 4,
      groups: GROUP_LETTERS_COUNT,
      bestThirds: BEST_THIRD_COUNT,
    },
    perMatch: {
      groupMax: maxGroupMatchRaw(),
      knockoutMax: koPerMatch,
    },
    raw: {
      group: groupRaw,
      inicioKnockout: inicioKoRaw,
      qualification: qualificationRaw,
      inicioTotal: inicioRaw,
      knockoutReal: knockoutRealRaw,
      bonus: bonusRaw,
      grandTotal: inicioRaw + knockoutRealRaw + bonusRaw,
    },
    weighted: {
      inicio: inicioWeighted,
      knockoutReal: knockoutWeighted,
      bonus: bonusRaw,
      total,
    },
    phaseWeight: { ...PHASE_WEIGHT },
  }
}

/** Máximos por columna del ranking (ponderados como en calcParticipantScoreColumns). */
export function getScoringColumnLimits() {
  const koPerMatch = maxKnockoutMatchRaw()
  const gepInicioRaw =
    (GROUP_MATCH_COUNT + KNOCKOUT_MATCH_COUNT) * SCORING.correctOutcome
  const gepKoRaw = KNOCKOUT_MATCH_COUNT * SCORING.correctOutcome
  const resInicioRaw =
    (GROUP_MATCH_COUNT + KNOCKOUT_MATCH_COUNT) * SCORING.exactScore
  const resKoRaw = KNOCKOUT_MATCH_COUNT * SCORING.exactScore
  const advInicioRaw = KNOCKOUT_MATCH_COUNT * SCORING.knockoutAdvance
  const advKoRaw = KNOCKOUT_MATCH_COUNT * SCORING.knockoutAdvance
  const m = calcScoringMaximum()

  const inicioGepPts = roundPts(gepInicioRaw * PHASE_WEIGHT.inicio)
  const inicioResultadoPts = roundPts(resInicioRaw * PHASE_WEIGHT.inicio)
  const inicioAdvancePts = roundPts(advInicioRaw * PHASE_WEIGHT.inicio)
  const qualificationPts = roundPts(maxQualificationRaw() * PHASE_WEIGHT.inicio)
  const inicioClasPasaPts = roundPts(inicioAdvancePts + qualificationPts)
  const knockoutGepPts = roundPts(gepKoRaw * PHASE_WEIGHT.knockoutReal)
  const knockoutResultadoPts = roundPts(resKoRaw * PHASE_WEIGHT.knockoutReal)
  const knockoutAdvancePts = roundPts(advKoRaw * PHASE_WEIGHT.knockoutReal)

  return {
    total: m.weighted.total,
    inicioPts: m.weighted.inicio,
    knockoutPts: m.weighted.knockoutReal,
    bonusPts: m.weighted.bonus,
    gepPts: roundPts(inicioGepPts + knockoutGepPts),
    resultadoPts: roundPts(inicioResultadoPts + knockoutResultadoPts),
    advancePts: roundPts(inicioAdvancePts + knockoutAdvancePts),
    inicioGepPts,
    inicioResultadoPts,
    inicioAdvancePts,
    inicioClasPasaPts,
    knockoutGepPts,
    knockoutResultadoPts,
    knockoutAdvancePts,
    qualificationPts,
    especialPts: SCORING.topScorer + SCORING.topKeeper + SCORING.topAssists,
    mvpPts: SCORING.mvp,
    perMatch: {
      group: maxGroupMatchRaw(),
      knockout: koPerMatch,
    },
  }
}

/** @type {ReturnType<typeof getScoringColumnLimits>} */
export const SCORING_COLUMN_LIMITS = getScoringColumnLimits()

export function formatPtsOfMax(value, max, { decimals = 1 } = {}) {
  const v = Number(value) || 0
  const m = Number(max) || 0
  const fmt = n => (decimals === 0 ? String(Math.round(n)) : String(roundPts(n)))
  return `${fmt(v)}/${fmt(m)}`
}
