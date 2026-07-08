import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcKnockoutAdvanceBonus,
  patchKnockoutScore,
  resolveKnockoutAdvanceSide,
  advancesFromPenaltyShootoutEvent,
  inferKnockoutAdvancesFromApiMatch,
} from './knockoutAdvances.js'
import { enrichKnockoutResultWithAdvances } from './knockoutRegulationScore.js'
import { calcMatchPoints, SCORING } from './gameData.js'

describe('knockoutAdvances', () => {
  it('resolves winner from advances on draw', () => {
    assert.equal(resolveKnockoutAdvanceSide({ home: 1, away: 1, advances: 'away' }), 'away')
  })

  it('awards +1 when advance pick matches result on draw', () => {
    const pred = { home: 1, away: 1, advances: 'home' }
    const res = { home: 1, away: 1, advances: 'home' }
    assert.equal(calcKnockoutAdvanceBonus(pred, res), 1)
    const pts = calcMatchPoints(pred, res, { knockout: true })
    assert.equal(pts, SCORING.correctOutcome + SCORING.exactScore + SCORING.knockoutAdvance)
  })

  it('awards +1 when winner matches on non-draw score (same cruce)', () => {
    const pred = { home: 2, away: 1 }
    const res = { home: 1, away: 0 }
    const teams = {
      predictedTeams: { home: 'Spain', away: 'France' },
      actualTeams: { home: 'Spain', away: 'France' },
    }
    assert.equal(calcKnockoutAdvanceBonus(pred, res, teams), 1)
    const pts = calcMatchPoints(pred, res, { knockout: true, ...teams })
    assert.equal(pts, SCORING.correctOutcome + SCORING.knockoutAdvance)
  })

  it('no advance bonus when winner differs', () => {
    const pred = { home: 2, away: 1 }
    const res = { home: 0, away: 1 }
    assert.equal(calcKnockoutAdvanceBonus(pred, res), 0)
  })

  it('clears advances when score is no longer a draw', () => {
    const next = patchKnockoutScore({ m1: { home: 1, away: 1, advances: 'home' } }, 'm1', 'home', '2')
    assert.equal(next.m1.advances, undefined)
    assert.equal(next.m1.home, 2)
  })

  it('infers advances from penalty shootout event', () => {
    assert.equal(
      advancesFromPenaltyShootoutEvent({ type: 'PenaltyShootout', homeScore: 4, awayScore: 5 }),
      'away',
    )
    assert.equal(
      inferKnockoutAdvancesFromApiMatch({
        score: { winner: 'DRAW', fullTime: { home: 1, away: 1 } },
        rawEvents: [{ type: 'PenaltyShootout', homeScore: 4, awayScore: 5 }],
      }),
      'away',
    )
  })

  it('awards +1 on draw when penalty winner matches prediction', () => {
    const pred = { home: 1, away: 1, advances: 'away' }
    const res = enrichKnockoutResultWithAdvances(
      { home: 1, away: 1 },
      {
        score: { winner: 'DRAW' },
        rawEvents: [{ type: 'PenaltyShootout', homeScore: 4, awayScore: 5 }],
      },
    )
    assert.equal(res.advances, 'away')
    assert.equal(calcKnockoutAdvanceBonus(pred, res), 1)
    const pts = calcMatchPoints(pred, res, { knockout: true })
    assert.equal(pts, SCORING.correctOutcome + SCORING.exactScore + SCORING.knockoutAdvance)
  })

  it('infers advances from penaltyShootoutWinner on match root', () => {
    assert.equal(
      inferKnockoutAdvancesFromApiMatch({
        penaltyShootoutWinner: 'home',
        score: { winner: 'DRAW', fullTime: { home: 0, away: 0 }, penaltyShootoutWinner: 'home' },
      }),
      'home',
    )
  })
})
