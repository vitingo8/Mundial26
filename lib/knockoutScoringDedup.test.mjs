import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calcParticipantScoreColumns } from './gameData.js'
import { transformKnockoutMatches } from './footballData.js'

describe('knockout scoring dedup', () => {
  it('transformKnockoutMatches never assigns duplicate FIFA numbers', () => {
    const api = [
      { id: '1', stage: 'LAST_16', utcDate: '2026-07-04T17:00:00Z', homeTeam: { name: 'Canada' }, awayTeam: { name: 'Morocco' }, status: 'FINISHED', score: { winner: 'AWAY_TEAM' } },
      { id: '2', stage: 'LAST_16', utcDate: '2026-07-04T21:00:00Z', homeTeam: { name: 'Paraguay' }, awayTeam: { name: 'France' }, status: 'FINISHED', score: { winner: 'AWAY_TEAM' } },
    ]
    const km = transformKnockoutMatches(api)
    const numbers = km.map(m => m.matchNumber).filter(n => n != null)
    assert.equal(numbers.length, new Set(numbers).size)
  })

  it('transformKnockoutMatches resolves octavos when dieciseisavos context exists', () => {
    const api = [
      { id: 'r73', stage: 'LAST_32', homeTeam: { name: 'South Africa' }, awayTeam: { name: 'Canada' }, score: { winner: 'AWAY_TEAM' }, status: 'FINISHED' },
      { id: 'r75', stage: 'LAST_32', homeTeam: { name: 'Netherlands' }, awayTeam: { name: 'Morocco' }, score: { winner: 'DRAW', penaltyShootoutWinner: 'away' }, status: 'FINISHED' },
      { id: 'r74', stage: 'LAST_32', homeTeam: { name: 'Germany' }, awayTeam: { name: 'Paraguay' }, score: { winner: 'DRAW', penaltyShootoutWinner: 'away' }, status: 'FINISHED' },
      { id: 'r77', stage: 'LAST_32', homeTeam: { name: 'France' }, awayTeam: { name: 'Sweden' }, score: { winner: 'HOME_TEAM' }, status: 'FINISHED' },
      { id: '1', stage: 'LAST_16', utcDate: '2026-07-04T17:00:00Z', homeTeam: { name: 'Canada' }, awayTeam: { name: 'Morocco' }, status: 'FINISHED', score: { winner: 'AWAY_TEAM' } },
      { id: '2', stage: 'LAST_16', utcDate: '2026-07-04T21:00:00Z', homeTeam: { name: 'Paraguay' }, awayTeam: { name: 'France' }, status: 'FINISHED', score: { winner: 'AWAY_TEAM' } },
    ]
    const km = transformKnockoutMatches(api)
    const byId = Object.fromEntries(km.map(m => [m.id, m]))
    assert.equal(byId['1'].matchNumber, 90)
    assert.equal(byId['2'].matchNumber, 89)
  })

  it('scores eliminatorias once per schedule slot, not per orphan pred id', () => {
    const knockoutMatches = [
      { id: 'api-84a', matchNumber: 84, roundId: 'r32', home: 'España', away: 'Austria', utcDate: '2026-07-02T19:00:00Z' },
      { id: 'api-84b', matchNumber: undefined, roundId: 'r32', home: 'Estados Unidos', away: 'Bosnia y Herzegovina', utcDate: '2026-07-02T22:00:00Z' },
    ]
    const participant = {
      predictions: {
        group: {},
        knockout: {
          'api-84a': { home: 3, away: 0 },
          'api-84b': { home: 2, away: 0 },
        },
        inicioKnockout: {},
      },
    }
    const group = {
      results: {
        group: {},
        knockout: {
          'api-84a': { home: 3, away: 0, matchNumber: 84 },
          'api-84b': { home: 2, away: 0, matchNumber: 84 },
        },
      },
      actuals: {},
    }

    const cols = calcParticipantScoreColumns(participant, group, { knockoutMatches })
    assert.equal(cols.knockoutRawPts, 9)
  })
})
