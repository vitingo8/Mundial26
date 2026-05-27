import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  knockoutMatchupMatches,
  resolveKnockoutTeamsForScoring,
} from './knockoutMatchScoring.js'
import { calcMatchPoints, SCORING } from './gameData.js'

describe('knockoutMatchScoring', () => {
  it('matchup matches when both teams align', () => {
    assert.ok(
      knockoutMatchupMatches(
        { home: 'España', away: 'Austria' },
        { home: 'Spain', away: 'Austria' },
      ),
    )
  })

  it('matchup fails when away team differs', () => {
    assert.ok(
      !knockoutMatchupMatches(
        { home: 'España', away: 'Austria' },
        { home: 'Spain', away: 'Germany' },
      ),
    )
  })

  it('full points only with matching cruce (ej. partido 84)', () => {
    const pred = { home: 3, away: 0 }
    const res = { home: 3, away: 0 }
    const teams = {
      predictedTeams: { home: 'España', away: 'Austria' },
      actualTeams: { home: 'Spain', away: 'Austria' },
    }
    assert.equal(
      calcMatchPoints(pred, res, { knockout: true, ...teams }),
      SCORING.correctOutcome + SCORING.exactScore + SCORING.knockoutAdvance,
    )
  })

  it('wrong cruce: only +1 when winner team matches', () => {
    const pred = { home: 3, away: 0 }
    const res = { home: 3, away: 0 }
    const teams = {
      predictedTeams: { home: 'España', away: 'Austria' },
      actualTeams: { home: 'Spain', away: 'Germany' },
    }
    assert.equal(
      calcMatchPoints(pred, res, { knockout: true, ...teams }),
      SCORING.knockoutAdvance,
    )
  })

  it('resolveKnockoutTeamsForScoring uses result teams', () => {
    const ctx = { predictedByNum: {}, actualByNum: {}, idToMatchNumber: {} }
    const { actualTeams } = resolveKnockoutTeamsForScoring('x', {
      matchNumber: 84,
      homeTeam: 'Spain',
      awayTeam: 'Germany',
    }, ctx)
    assert.equal(actualTeams.home, 'Spain')
    assert.equal(actualTeams.away, 'Germany')
  })
})
