import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getOutcome, calcParticipantScoreColumns } from './gameData.js'
import { generateGroupMatches, GROUPS_DATA } from './gameData.js'
import {
  buildInicioKnockoutScoringState,
  calcInicioKnockoutPointsForId,
} from './inicioKnockoutScoring.js'
const __dirname = dirname(fileURLToPath(import.meta.url))

export const TEST_SCORING_GROUP_ID = '_test_scoring'
export const TEST_SCORING_PARTICIPANT_ID = '_test_scoring_participant'
export const TEST_SCORING_EMAIL = '_test_scoring@fixture.invalid'

/** Predicciones completas (72 grupos + 32 inicio KO + bonos). */
export const TEST_PREDICTIONS = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'test-scoring-predictions.json'), 'utf8'),
)

function outcomeOnlyVariant(pred) {
  const o = getOutcome(pred.home, pred.away)
  if (o === 'D') return { home: pred.home + 1, away: pred.away + 1 }
  if (o === 'H') return { home: pred.home + 1, away: pred.away }
  return { home: pred.home, away: pred.away + 1 }
}

function missVariant(pred) {
  const o = getOutcome(pred.home, pred.away)
  if (o === 'D') return { home: 1, away: 0 }
  if (o === 'H') {
    return { home: pred.home, away: Math.max(pred.away + 3, pred.home + 1) }
  }
  return { home: Math.max(pred.home + 3, pred.away + 1), away: pred.away }
}

/** Resultado ficticio para eliminatorias (incl. quién pasa en empate). */
function buildKnockoutStyleResult(pred, mode) {
  if (mode === 'exact') {
    const res = { home: pred.home, away: pred.away }
    if (pred.advances && getOutcome(pred.home, pred.away) === 'D') {
      res.advances = pred.advances
    }
    return res
  }
  if (mode === 'outcome') {
    const res = outcomeOnlyVariant(pred)
    if (pred.advances && getOutcome(res.home, res.away) === 'D') {
      res.advances = pred.advances
    }
    return res
  }
  const res = missVariant(pred)
  if (getOutcome(res.home, res.away) === 'D') {
    res.advances = pred.advances === 'home' ? 'away' : 'home'
  }
  return res
}

function applyPattern(map, { knockoutStyle = false } = {}) {
  const out = {}
  const ids = Object.keys(map || {}).sort()
  ids.forEach((id, i) => {
    const pred = map[id]
    const mode = i % 3 === 0 ? 'exact' : i % 3 === 1 ? 'outcome' : 'miss'
    out[id] = knockoutStyle ? buildKnockoutStyleResult(pred, mode) : (
      mode === 'exact'
        ? { home: pred.home, away: pred.away }
        : mode === 'outcome'
          ? outcomeOnlyVariant(pred)
          : missVariant(pred)
    )
  })
  return out
}

/**
 * Resultados reales inventados (no API).
 * Fase grupos → results.group; bracket inicio → results.knockout (mismas reglas KO).
 */
export function buildTestRealResults(predictions = TEST_PREDICTIONS) {
  return {
    group: applyPattern(predictions.group),
    knockout: applyPattern(predictions.inicioKnockout || {}, { knockoutStyle: true }),
  }
}

export const TEST_REAL_RESULTS = buildTestRealResults()

/** Actuals alineados con las predicciones de bonos del fixture (todos aciertan). */
export const TEST_ACTUALS = {
  topScorer: 'Mbappe',
  topKeeper: 'Joan Garcia',
  topAssists: 'Lamine Yamal',
  mvp: 'Lamine Yamal',
}

export const TEST_GROUP_ROW = {
  id: TEST_SCORING_GROUP_ID,
  name: '🧪 Prueba cálculo puntos',
  admin_id: TEST_SCORING_PARTICIPANT_ID,
  phase: 'group',
  group_deadline: '2026-06-10T23:59:59+02:00',
  knockout_deadline: '2026-06-28T23:59:59+02:00',
  bonus_deadline: '2026-07-10T23:59:59+02:00',
  actuals: TEST_ACTUALS,
  results: TEST_REAL_RESULTS,
}

export const TEST_PARTICIPANT_ROW = {
  id: TEST_SCORING_PARTICIPANT_ID,
  group_id: TEST_SCORING_GROUP_ID,
  name: 'Verificador puntos',
  email: TEST_SCORING_EMAIL,
  is_admin: false,
  predictions: TEST_PREDICTIONS,
}

function buildExpectedColumns() {
  const groupMatches = generateGroupMatches(GROUPS_DATA)
  return calcParticipantScoreColumns(
    { predictions: TEST_PREDICTIONS },
    { results: TEST_REAL_RESULTS, actuals: TEST_ACTUALS },
    { groupMatches, knockoutMatches: [] },
  )
}

export const TEST_EXPECTED_SCORE = buildExpectedColumns()

/** Puntos en bruto del bracket Inicio (sin ×0,6). */
export function calcInicioKnockoutFixturePts() {
  const groupMatches = generateGroupMatches(GROUPS_DATA)
  const state = buildInicioKnockoutScoringState(
    { predictions: TEST_PREDICTIONS },
    {
      groupMatches,
      knockoutMatches: [],
      knockoutResults: TEST_REAL_RESULTS.knockout,
    },
  )
  let total = 0
  for (const [id, pred] of Object.entries(TEST_PREDICTIONS.inicioKnockout || {})) {
    const split = calcInicioKnockoutPointsForId(id, pred, state)
    total += split.gep + split.resultado + split.advance
  }
  return total
}

/** Resumen legible para consola / documentación. */
export function formatTestScoringSummary() {
  const e = TEST_EXPECTED_SCORE
  const nGroup = Object.keys(TEST_PREDICTIONS.group).length
  const nInicio = Object.keys(TEST_PREDICTIONS.inicioKnockout || {}).length
  const koPrevistoRaw = calcInicioKnockoutFixturePts()
  const groupRaw = e.inicioRawPts - koPrevistoRaw
  return [
    `Inicio (×0,6): ${nGroup} partidos de grupos → ${groupRaw} pts bruto`,
    `Inicio (×0,6): ${nInicio} cruces KO previstos (antes del pitido) → ${koPrevistoRaw} pts bruto`,
    `Inicio total bruto ${e.inicioRawPts} → ponderado ${e.inicioPts} · Eliminatorias reales (×0,4): ${e.knockoutPts}`,
    `Bonos: los 4 campos + MVP aciertan → ${e.especialPts + e.mvpPts} pts`,
    `G/E/P (pond.): ${e.gepPts} · Resultado (pond.): ${e.resultadoPts} · Especial: ${e.especialPts} · MVP: ${e.mvpPts}`,
    `TOTAL clasificación: ${e.total}`,
  ].join('\n')
}
