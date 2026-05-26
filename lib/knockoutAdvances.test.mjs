import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcKnockoutAdvanceBonus,
  patchKnockoutScore,
  resolveKnockoutAdvanceSide,
} from './knockoutAdvances.js'
import { calcMatchPoints, SCORING } from './gameData.js'

describe('knockoutAdvances', () => {
  it('resolves winner from advances on draw', () => {
    assert.equal(resolveKnockoutAdvanceSide({ home: 1, away: 1, advances: 'away' }), 'away')
  })

  it('awards +1 when advance pick matches result', () => {
    const pred = { home: 1, away: 1, advances: 'home' }
    const res = { home: 1, away: 1, advances: 'home' }
    assert.equal(calcKnockoutAdvanceBonus(pred, res), 1)
    const pts = calcMatchPoints(pred, res, { knockout: true })
    assert.equal(pts, SCORING.correctOutcome + SCORING.exactScore + SCORING.knockoutAdvance)
  })

  it('clears advances when score is no longer a draw', () => {
    const next = patchKnockoutScore({ m1: { home: 1, away: 1, advances: 'home' } }, 'm1', 'home', '2')
    assert.equal(next.m1.advances, undefined)
    assert.equal(next.m1.home, 2)
  })
})
