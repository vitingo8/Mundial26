import test from 'node:test'
import assert from 'node:assert/strict'
import { finishedMatchesToResults } from './adminCsv.js'
import { SCORING } from './gameData.js'
import { inicioKoMatchId } from './knockoutBridge.js'
import {
  buildInicioKnockoutScoringState,
  calcInicioKnockoutPointsForId,
} from './inicioKnockoutScoring.js'

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
  const knockoutMatches = [{
    id: '4812345',
    stage: 'LAST_32',
    matchNumber: 73,
    home: 'México',
    away: 'Suiza',
  }]
  const { knockout: knockoutResults } = finishedMatchesToResults([{
    id: '4812345',
    stage: 'LAST_32',
    status: 'FINISHED',
    matchNumber: 73,
    score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
    homeTeam: { name: 'Mexico' },
    awayTeam: { name: 'Switzerland' },
  }])

  const state = buildInicioKnockoutScoringState(
    {
      predictions: {
        group: {},
        inicioKnockout: { [inicioKoMatchId(73)]: { home: 2, away: 1 } },
        knockout: {},
      },
    },
    { groupMatches: [], knockoutMatches, knockoutResults },
  )
  state.inicioPredictedById[inicioKoMatchId(73)] = {
    home: 'México',
    away: 'Suiza',
    matchNumber: 73,
    roundId: 'r32',
  }

  const split = calcInicioKnockoutPointsForId(
    inicioKoMatchId(73),
    { home: 2, away: 1 },
    state,
  )
  assert.equal(split.gep, SCORING.correctOutcome)
  assert.equal(split.resultado, SCORING.exactScore)
})

test('finishedMatchesToResults uses 90 min score when extra time was played', () => {
  const { knockout } = finishedMatchesToResults([{
    id: '4812999',
    stage: 'LAST_32',
    status: 'FINISHED',
    matchNumber: 74,
    score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' },
    rawEvents: [
      { type: 'Half', halfStrShort: 'FT', homeScore: 1, awayScore: 1 },
      { type: 'Half', halfStrShort: 'AET', homeScore: 2, awayScore: 1 },
    ],
    homeTeam: { name: 'Germany' },
    awayTeam: { name: 'Paraguay' },
  }])
  assert.equal(knockout['4812999']?.home, 1)
  assert.equal(knockout['4812999']?.away, 1)
  assert.equal(knockout['4812999']?.advances, 'home')
})
