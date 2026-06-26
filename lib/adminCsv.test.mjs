import test from 'node:test'
import assert from 'node:assert/strict'
import { finishedMatchesToResults } from './adminCsv.js'
import { calcParticipantScoreColumns } from './gameData.js'
import { inicioKoMatchId } from './knockoutBridge.js'

test('finishedMatchesToResults mirrors knockout scores to inicio-ko ids', () => {
  const matches = [{
    id: '4812345',
    stage: 'LAST_32',
    status: 'FINISHED',
    matchNumber: 73,
    score: {
      fullTime: { home: 2, away: 1 },
      winner: 'HOME_TEAM',
    },
    homeTeam: { name: 'Mexico' },
    awayTeam: { name: 'Switzerland' },
  }]

  const { knockout } = finishedMatchesToResults(matches)
  assert.equal(knockout['4812345']?.home, 2)
  assert.equal(knockout[inicioKoMatchId(73)]?.home, 2)
  assert.equal(knockout['knockout-ko-73']?.away, 1)
})

test('inicio knockout preds score when API stores results by match id', () => {
  const groupMatches = []
  const knockoutMatches = [{
    id: '4812345',
    stage: 'LAST_32',
    matchNumber: 73,
    home: 'México',
    away: 'Suiza',
  }]
  const results = finishedMatchesToResults([{
    id: '4812345',
    stage: 'LAST_32',
    status: 'FINISHED',
    matchNumber: 73,
    score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
    homeTeam: { name: 'Mexico' },
    awayTeam: { name: 'Switzerland' },
  }])

  const cols = calcParticipantScoreColumns(
    {
      predictions: {
        group: {},
        inicioKnockout: { [inicioKoMatchId(73)]: { home: 2, away: 1 } },
        knockout: {},
      },
    },
    { results, actuals: {} },
    { groupMatches, knockoutMatches },
  )

  assert.equal(cols.inicioGepPts, 1.8)
  assert.equal(cols.inicioResultadoPts, 3)
})
