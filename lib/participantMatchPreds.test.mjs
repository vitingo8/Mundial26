import test from 'node:test'
import assert from 'node:assert/strict'
import { getParticipantPredsForMatch } from './participantMatchPreds.js'

const groupMatches = [
  {
    id: 'fotmob-1',
    matchNumber: 1,
    group: 'A',
    home: 'España',
    away: 'Croacia',
    utcDate: '2026-06-15T19:00:00Z',
  },
]

test('getParticipantPredsForMatch incluye todos los participantes con IDs legacy', () => {
  const participants = {
    a: {
      id: 'a',
      name: 'Ana',
      predictions: { group: { 'fotmob-1': { home: 2, away: 1 } } },
    },
    b: {
      id: 'b',
      name: 'Bea',
      predictions: { group: { 'catalog-1': { home: 1, away: 1 } } },
    },
    c: {
      id: 'c',
      name: 'Carlos',
      predictions: { group: {} },
    },
  }

  const rows = getParticipantPredsForMatch(participants, 'fotmob-1', { groupMatches })
  assert.equal(rows.length, 2)
  assert.deepEqual(
    rows.map(r => r.label).sort(),
    ['Ana', 'Bea'],
  )
})
