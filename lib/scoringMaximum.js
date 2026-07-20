import { SCORING, PHASE_WEIGHT } from './gameData.js'
import {
  QUALIFICATION_SCORING,
  resolveActualQualifiers,
} from './groupQualificationScoring.js'
import { FIFA_MATCH_COUNT } from './fifaMatchNumbers.js'
import { migrateGroupResults } from './matchIdMap.js'
import { finishedMatchesToResults } from './adminCsv.js'
import { inicioKoMatchId } from './knockoutBridge.js'

function mergeStoredWithApiResults(stored, apiMatches) {
  const { group, knockout } = finishedMatchesToResults(apiMatches || [])
  return {
    group: { ...(stored?.group || {}), ...group },
    knockout: { ...(stored?.knockout || {}), ...knockout },
  }
}

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

function countPublishedResults(map = {}) {
  return Object.values(map).filter(r => r?.home != null && r?.away != null).length
}

/**
 * Partidos del KO previsto (Inicio) con resultado publicado.
 * Usa el calendario real (IDs numéricos) — no solo claves inicio-ko-*,
 * que se pierden al migrar resultados legacy.
 */
export function countInicioKoPublishedResults(knockoutResults = {}, knockoutMatches = []) {
  const results = knockoutResults || {}
  const seen = new Set()
  let count = 0

  for (const m of knockoutMatches || []) {
    if (m.matchNumber == null) continue
    const resId = String(m.id)
    const published =
      results[resId] ??
      results[inicioKoMatchId(m.matchNumber)] ??
      Object.values(results).find(
        r => r?.matchNumber === m.matchNumber && r?.home != null && r?.away != null,
      )
    if (published?.home == null || published?.away == null) continue
    if (seen.has(m.matchNumber)) continue
    seen.add(m.matchNumber)
    count += 1
  }

  return count
}

/** Plazas de clasificación confirmadas (FotMob, R32 o tablas desde resultados publicados). */
export function countConfirmedQualificationSlots(scoringOpts = {}) {
  const actual = resolveActualQualifiers({
    fotmobStandings: scoringOpts.fotmobStandings,
    knockoutMatches: scoringOpts.knockoutMatches ?? [],
    groupMatches: scoringOpts.groupMatches ?? [],
    apiMatches: scoringOpts.apiMatches ?? [],
    groupResults: scoringOpts.groupResults ?? {},
  })
  return Math.min(actual.resolvedCount ?? 0, R32_TEAM_SLOTS)
}

/**
 * Máximos disputados (solo partidos/bonos con resultado publicado).
 * @param {object} [group]
 * @param {{ groupMatches?: object[], knockoutMatches?: object[] }} [scoringOpts]
 */
export function getScoringDisputedLimits(group, scoringOpts = {}) {
  const { groupMatches = [], knockoutMatches = [], apiMatches = [] } = scoringOpts
  const merged = mergeStoredWithApiResults(group?.results || {}, apiMatches)
  const results = migrateGroupResults(merged, groupMatches, knockoutMatches)
  const actuals = group?.actuals || {}

  const groupPlayed = countPublishedResults(results.group)
  const inicioKoPlayed = countInicioKoPublishedResults(results.knockout, knockoutMatches)
  const realKoPlayed = Object.entries(results.knockout || {}).filter(
    ([id, r]) => /^\d+$/.test(String(id)) && r?.home != null && r?.away != null,
  ).length

  const qualSlots = countConfirmedQualificationSlots({
    ...scoringOpts,
    groupResults: results.group,
  })
  const qualificationRaw =
    qualSlots * (QUALIFICATION_SCORING.qualifies + QUALIFICATION_SCORING.exactPosition)
  const inicioAdvanceRaw = inicioKoPlayed * SCORING.knockoutAdvance

  const inicioRaw =
    groupPlayed * maxGroupMatchRaw() +
    inicioKoPlayed * maxKnockoutMatchRaw() +
    qualificationRaw
  const knockoutRaw = realKoPlayed * maxKnockoutMatchRaw()

  const inicioPts = roundPts(inicioRaw * PHASE_WEIGHT.inicio)
  const knockoutPts = roundPts(knockoutRaw * PHASE_WEIGHT.knockoutReal)
  const qualificationDisputedPts = roundPts(qualificationRaw * PHASE_WEIGHT.inicio)
  const inicioAdvanceDisputedPts = roundPts(inicioAdvanceRaw * PHASE_WEIGHT.inicio)

  let especialPts = 0
  if (actuals.topScorer) especialPts += SCORING.topScorer
  if (actuals.topKeeper) especialPts += SCORING.topKeeper
  if (actuals.topAssists) especialPts += SCORING.topAssists

  const mvpPts = actuals.mvp ? SCORING.mvp : 0
  const total = roundPts(inicioPts + knockoutPts + especialPts + mvpPts)

  return {
    total,
    inicioPts,
    knockoutPts,
    especialPts,
    mvpPts,
    qualificationDisputedPts,
    inicioAdvanceDisputedPts,
    qualificationSlots: qualSlots,
  }
}

export function formatPtsOfMax(value, max, { decimals = 1 } = {}) {
  const v = Number(value) || 0
  const m = Number(max) || 0
  const fmt = n => (decimals === 0 ? String(Math.round(n)) : String(roundPts(n)))
  if (m <= 0) return `${fmt(v)}/—`
  return `${fmt(v)}/${fmt(m)}`
}

/** Progreso disputado de una fase: «23% de 567». */
export function formatDisputedProgress(disputed, totalMax) {
  const d = Number(disputed) || 0
  const m = Number(totalMax) || 0
  if (m <= 0) return '0% de —'
  const pct = Math.round((d / m) * 100)
  const maxLabel = Number.isInteger(m) ? String(m) : String(roundPts(m))
  return `${pct}% de ${maxLabel}`
}
