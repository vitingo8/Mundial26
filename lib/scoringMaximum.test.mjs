import test from 'node:test'
import assert from 'node:assert/strict'
import { calcScoringMaximum, getScoringColumnLimits, getScoringDisputedLimits, formatPtsOfMax, formatCategoryPct } from './scoringMaximum.js'
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
          'inicio-ko-1': { home: 1, away: 0 },
          'ko-1': { home: 3, away: 1 },
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

test('formatPtsOfMax — sin disputados muestra guión', () => {
  assert.equal(formatPtsOfMax(3, 0), '3/—')
})

test('formatCategoryPct', () => {
  assert.equal(formatCategoryPct(30, 100), '30%')
  assert.equal(formatCategoryPct(0, 0), '0%')
})

function roundPts(n) {
  return Math.round(n * 10) / 10
}
