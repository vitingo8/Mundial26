import test from 'node:test'
import assert from 'node:assert/strict'
import { calcScoringMaximum, getScoringColumnLimits } from './scoringMaximum.js'

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
  assert.equal(
    c.gepPts + c.resultadoPts + c.advancePts + c.qualificationPts,
    c.inicioPts + c.knockoutPts,
  )
})
