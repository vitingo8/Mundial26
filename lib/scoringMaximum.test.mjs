import test from 'node:test'
import assert from 'node:assert/strict'
import { calcScoringMaximum, getScoringColumnLimits, getScoringDisputedLimits, formatPtsOfMax, formatDisputedProgress, countConfirmedQualificationSlots } from './scoringMaximum.js'
import { PHASE_WEIGHT, SCORING } from './gameData.js'

test('calcScoringMaximum — techo con +1 en empates KO', () => {
  const m = calcScoringMaximum()
  assert.equal(m.raw.group, 72 * 8)
  assert.equal(m.raw.qualification, 32 * 2)
  assert.equal(m.raw.inicioKnockout, 32 * 9)
  assert.equal(m.raw.knockoutReal, 32 * 9)
  assert.equal(m.raw.bonus, 28)
  assert.equal(m.weighted.total, 700)
})

test('calcScoringMaximum — techo sin bonus de empate KO', () => {
  const m = calcScoringMaximum({ knockoutWithAdvance: false })
  assert.equal(m.weighted.total, 668)
})

test('getScoringColumnLimits — columnas suman al total', () => {
  const c = getScoringColumnLimits()
  const parts =
    c.inicioPts + c.knockoutPts + c.bonusPts
  assert.equal(parts, c.total)
  const partsSum =
    c.inicioGepPts +
    c.inicioResultadoPts +
    c.inicioClasPasaPts +
    c.knockoutGepPts +
    c.knockoutResultadoPts +
    c.knockoutAdvancePts
  assert.ok(Math.abs(c.inicioClasPasaPts - (c.inicioAdvancePts + c.qualificationPts)) < 0.05)
  assert.ok(Math.abs(partsSum - (c.inicioPts + c.knockoutPts)) < 0.15)
  assert.equal(c.gepPts, c.inicioGepPts + c.knockoutGepPts)
})

test('getScoringDisputedLimits — sin resultados publicados', () => {
  const d = getScoringDisputedLimits({ results: {}, actuals: {} })
  assert.equal(d.total, 0)
  assert.equal(d.inicioPts, 0)
  assert.equal(d.knockoutPts, 0)
  assert.equal(d.especialPts, 0)
  assert.equal(d.mvpPts, 0)
})

test('getScoringDisputedLimits — partidos y bonos publicados', () => {
  const d = getScoringDisputedLimits(
    {
      results: {
        group: { 'g1': { home: 1, away: 0 }, 'g2': { home: 2, away: 2 } },
        knockout: {
          'inicio-ko-73': { home: 1, away: 0 },
          '4812345': { home: 3, away: 1, matchNumber: 89 },
        },
      },
      actuals: { topScorer: 'X', mvp: 'Y' },
    },
    { groupMatches: [], knockoutMatches: [] },
  )
  assert.equal(d.inicioPts, roundPts((2 * 8 + 1 * 9) * PHASE_WEIGHT.inicio))
  assert.equal(d.knockoutPts, roundPts(1 * 9 * PHASE_WEIGHT.knockoutReal))
  assert.equal(d.especialPts, SCORING.topScorer)
  assert.equal(d.mvpPts, SCORING.mvp)
  assert.equal(d.total, roundPts(d.inicioPts + d.knockoutPts + d.especialPts + d.mvpPts))
})

test('getScoringDisputedLimits — plazas FotMob confirmadas', () => {
  const groupMatches = [
    { id: 'a1', group: 'A', home: 'X', away: 'Y' },
    { id: 'a2', group: 'A', home: 'X', away: 'Y' },
    { id: 'b1', group: 'B', home: 'X', away: 'Y' },
    { id: 'b2', group: 'B', home: 'X', away: 'Y' },
    { id: 'c1', group: 'C', home: 'X', away: 'Y' },
    { id: 'c2', group: 'C', home: 'X', away: 'Y' },
  ]
  const apiMatches = groupMatches.map(m => ({
    id: m.id,
    stage: 'GROUP_STAGE',
    group: `GROUP_${m.group}`,
    status: 'FINISHED',
    score: { fullTime: { home: 1, away: 0 } },
  }))
  const d = getScoringDisputedLimits(
    { results: { group: {}, knockout: {} }, actuals: {} },
    {
      groupMatches,
      knockoutMatches: [],
      apiMatches,
      fotmobStandings: {
        ready: true,
        resolvedCount: 6,
        byGroup: {
          ...Object.fromEntries('DEFGHIJKL'.split('').map(g => [g, { 1: null, 2: null, 3: null }])),
          A: { 1: 'T1', 2: 'T2', 3: null },
          B: { 1: 'T3', 2: 'T4', 3: null },
          C: { 1: 'T5', 2: 'T6', 3: null },
        },
      },
    },
  )
  assert.equal(d.qualificationSlots, 6)
  assert.equal(d.qualificationDisputedPts, roundPts(6 * 2 * PHASE_WEIGHT.inicio))
  assert.equal(d.inicioAdvanceDisputedPts, 0)
})

test('countConfirmedQualificationSlots — sin standings en vivo no usa R32 parcial', () => {
  const groupMatches = [{ id: '4667751', group: 'A', home: 'México', away: 'Sudáfrica' }]
  const apiMatches = [{
    id: '4667751',
    stage: 'GROUP_STAGE',
    group: 'GROUP_A',
    status: 'FINISHED',
    score: { fullTime: { home: 1, away: 0 } },
  }]
  const slots = countConfirmedQualificationSlots({
    groupMatches,
    knockoutMatches: [{ id: 'k1', homeSource: '1A', homeTeam: { name: 'X' } }],
    fotmobStandings: null,
    apiMatches,
  })
  assert.equal(slots, 0)
})

test('formatPtsOfMax — sin disputados muestra guión', () => {
  assert.equal(formatPtsOfMax(3, 0), '3/—')
})

test('formatDisputedProgress', () => {
  assert.equal(formatDisputedProgress(135.6, 556.8), '24% de 556.8')
  assert.equal(formatDisputedProgress(0, 0), '0% de —')
  assert.equal(formatDisputedProgress(100, 567), '18% de 567')
})

function roundPts(n) {
  return Math.round(n * 10) / 10
}
