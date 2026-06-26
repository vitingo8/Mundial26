import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCompletedGroupLetters,
  filterQualifiersByCompletedGroups,
  buildBracketQualifiersFromFotmob,
  isGroupMatchFinished,
} from './groupStageCompletion.js'

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

test('buildBracketQualifiersFromFotmob keeps 1st/2nd in open groups', () => {
  const byGroup = {
    J: { 1: 'Argentina', 2: 'Austria', 3: 'Algeria' },
    A: { 1: 'Mexico', 2: 'South Africa', 3: 'South Korea' },
  }
  const bracket = buildBracketQualifiersFromFotmob(byGroup, new Set(['A']))
  assert.equal(bracket.J[1], 'Argentina')
  assert.equal(bracket.J[2], 'Austria')
  assert.equal(bracket.J[3], null)
  assert.equal(bracket.A[3], 'South Korea')
})
