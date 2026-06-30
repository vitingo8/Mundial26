import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calcMatchPoints, SCORING } from './gameData.js'
import { getRegulationTimeScore, normalizeKnockoutResultForScoring } from './knockoutRegulationScore.js'

describe('knockoutRegulationScore', () => {
  it('uses FT half score when extra time was played', () => {
    const api = {
      score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      rawEvents: [
        { type: 'Half', halfStrShort: 'FT', homeScore: 1, awayScore: 1 },
        { type: 'Half', halfStrShort: 'AET', homeScore: 2, awayScore: 1 },
      ],
    }
    assert.deepEqual(getRegulationTimeScore(api), { home: 1, away: 1 })
  })

  it('uses fullTime when no extra time', () => {
    const api = {
      score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      rawEvents: [{ type: 'Half', halfStrShort: 'FT', homeScore: 2, awayScore: 1 }],
    }
    assert.deepEqual(getRegulationTimeScore(api), { home: 2, away: 1 })
  })

  it('normalizes to 90 min and adds advances after ET winner', () => {
    const api = {
      score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      rawEvents: [
        { type: 'Half', halfStrShort: 'FT', homeScore: 1, awayScore: 1 },
        { type: 'Half', halfStrShort: 'AET', homeScore: 2, awayScore: 1 },
      ],
    }
    const res = normalizeKnockoutResultForScoring({ home: 2, away: 1, matchNumber: 74 }, api)
    assert.equal(res.home, 1)
    assert.equal(res.away, 1)
    assert.equal(res.advances, 'home')
  })

  it('scores draw at 90 with ET winner advance pick', () => {
    const api = {
      score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
      rawEvents: [
        { type: 'Half', halfStrShort: 'FT', homeScore: 1, awayScore: 1 },
        { type: 'Half', halfStrShort: 'AET', homeScore: 2, awayScore: 1 },
      ],
    }
    const pred = { home: 1, away: 1, advances: 'home' }
    const res = normalizeKnockoutResultForScoring({ home: 2, away: 1 }, api)
    const pts = calcMatchPoints(pred, res, { knockout: true })
    assert.equal(pts, SCORING.correctOutcome + SCORING.exactScore + SCORING.knockoutAdvance)
  })
})
