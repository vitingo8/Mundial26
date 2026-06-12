import test from 'node:test'
import assert from 'node:assert/strict'
import { getApiMatchDisplayScore, isMatchStarted } from './apiMatchScores.js'

test('isMatchStarted rejects upcoming fixtures', () => {
  assert.equal(isMatchStarted({ status: 'TIMED' }), false)
  assert.equal(isMatchStarted({ status: 'SCHEDULED' }), false)
})

test('isMatchStarted accepts live and finished', () => {
  assert.equal(isMatchStarted({ status: 'IN_PLAY' }), true)
  assert.equal(isMatchStarted({ status: 'FINISHED' }), true)
})

test('getApiMatchDisplayScore hides score before kickoff even if API sends 0-0', () => {
  const upcoming = {
    status: 'TIMED',
    score: { fullTime: { home: 0, away: 0 } },
  }
  assert.equal(getApiMatchDisplayScore(upcoming), null)
})

test('getApiMatchDisplayScore shows finished result', () => {
  const finished = {
    status: 'FINISHED',
    score: { fullTime: { home: 2, away: 1 } },
  }
  assert.deepEqual(getApiMatchDisplayScore(finished), { home: 2, away: 1 })
})

test('getApiMatchDisplayScore shows live score', () => {
  const live = {
    status: 'IN_PLAY',
    score: { fullTime: { home: 1, away: 0 }, halfTime: { home: null, away: null } },
  }
  assert.deepEqual(getApiMatchDisplayScore(live), { home: 1, away: 0 })
})
