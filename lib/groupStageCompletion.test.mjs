import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCompletedGroupLetters,
  filterQualifiersByCompletedGroups,
  isGroupMatchFinished,
} from './groupStageCompletion.js'
import { getMathematicallyLockedPositions } from './groupPositionLock.js'

const groupMatches = [
  { id: 'a1', group: 'A', home: 'México', away: 'Sudáfrica' },
  { id: 'a2', group: 'A', home: 'Corea', away: 'X' },
  { id: 'b1', group: 'B', home: 'Canadá', away: 'Suiza' },
]

test('isGroupMatchFinished', () => {
  assert.equal(
    isGroupMatchFinished({
      status: 'FINISHED',
      score: { fullTime: { home: 1, away: 0 } },
    }),
    true,
  )
  assert.equal(isGroupMatchFinished({ status: 'IN_PLAY' }), false)
})

test('getCompletedGroupLetters — grupo completo vs pendiente', () => {
  const apiMatches = [
    { id: 'a1', stage: 'GROUP_STAGE', group: 'GROUP_A', status: 'FINISHED', score: { fullTime: { home: 2, away: 1 } } },
    { id: 'a2', stage: 'GROUP_STAGE', group: 'GROUP_A', status: 'SCHEDULED' },
    { id: 'b1', stage: 'GROUP_STAGE', group: 'GROUP_B', status: 'FINISHED', score: { fullTime: { home: 1, away: 1 } } },
  ]
  const done = getCompletedGroupLetters(apiMatches, groupMatches)
  assert.ok(!done.has('A'))
  assert.ok(done.has('B'))
})

test('filterQualifiersByCompletedGroups', () => {
  const byGroup = {
    A: { 1: 'México', 2: 'Corea', 3: null },
    B: { 1: 'Canadá', 2: 'Suiza', 3: null },
  }
  const filtered = filterQualifiersByCompletedGroups(byGroup, new Set(['B']))
  assert.equal(filtered.A[1], null)
  assert.equal(filtered.B[1], 'Canadá')
})

test('getMathematicallyLockedPositions — solo 1.º fijo en grupo abierto', () => {
  const groupMatches = [
    { id: 'j1', group: 'J', home: 'Argentina', away: 'Argelia' },
    { id: 'j2', group: 'J', home: 'Austria', away: 'Jordania' },
    { id: 'j3', group: 'J', home: 'Argentina', away: 'Austria' },
    { id: 'j4', group: 'J', home: 'Jordania', away: 'Argelia' },
    { id: 'j5', group: 'J', home: 'Argelia', away: 'Austria' },
    { id: 'j6', group: 'J', home: 'Jordania', away: 'Argentina' },
  ]
  const apiMatches = [
    { id: 'j1', status: 'FINISHED', score: { fullTime: { home: 3, away: 0 } } },
    { id: 'j2', status: 'FINISHED', score: { fullTime: { home: 3, away: 1 } } },
    { id: 'j3', status: 'FINISHED', score: { fullTime: { home: 2, away: 0 } } },
    { id: 'j4', status: 'FINISHED', score: { fullTime: { home: 1, away: 2 } } },
    { id: 'j5', status: 'SCHEDULED' },
    { id: 'j6', status: 'SCHEDULED' },
  ]
  const locked = getMathematicallyLockedPositions('J', groupMatches, apiMatches)
  assert.equal(locked[1], 'Argentina')
  assert.equal(locked[2], null)
})
