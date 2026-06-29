import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getEliminatoriasReminderMatches,
  isEliminatoriasPredComplete,
  getEliminatoriasPredIncompleteReason,
  ELIMINATORIAS_REMINDER_WINDOW_MS,
} from './eliminatoriasReminder.js'

describe('isEliminatoriasPredComplete', () => {
  it('requires both scores', () => {
    assert.equal(isEliminatoriasPredComplete({ home: 1 }), false)
    assert.equal(isEliminatoriasPredComplete({ home: 1, away: 0 }), true)
  })

  it('requires advance pick on draws', () => {
    assert.equal(isEliminatoriasPredComplete({ home: 1, away: 1 }), false)
    assert.equal(isEliminatoriasPredComplete({ home: 1, away: 1, advances: 'home' }), true)
  })
})

describe('getEliminatoriasPredIncompleteReason', () => {
  it('describes missing fields', () => {
    assert.equal(getEliminatoriasPredIncompleteReason(null), 'Falta el marcador')
    assert.equal(getEliminatoriasPredIncompleteReason({ home: 1, away: 1 }), 'Falta indicar quién pasa (empate)')
    assert.equal(getEliminatoriasPredIncompleteReason({ home: 2, away: 1 }), null)
  })
})

describe('getEliminatoriasReminderMatches', () => {
  const now = new Date('2026-07-03T20:00:00Z')
  const match = {
    id: 'ko-87',
    matchNumber: 87,
    stage: 'LAST_32',
    roundId: 'r32',
    home: 'Colombia',
    away: 'Ghana',
    homeSource: '1K',
    awaySource: '3D/E/I/J/L',
    utcDate: '2026-07-03T22:00:00Z',
  }
  const fotmobStandings = {
    ready: true,
    byGroup: {
      K: { 1: 'Colombia', 2: 'Portugal', 3: 'Uzbekistán' },
      L: { 1: 'Inglaterra', 2: 'Croacia', 3: 'Ghana' },
    },
    bestThirds: [],
  }
  const groupMatches = [
    { id: 'k1', group: 'K', home: 'Colombia', away: 'Portugal' },
    { id: 'k2', group: 'K', home: 'Colombia', away: 'Uzbekistán' },
    { id: 'k3', group: 'K', home: 'Portugal', away: 'Uzbekistán' },
    { id: 'l1', group: 'L', home: 'Ghana', away: 'Panamá' },
    { id: 'l2', group: 'L', home: 'Ghana', away: 'Croacia' },
    { id: 'l3', group: 'L', home: 'Croacia', away: 'Panamá' },
  ]
  const apiMatches = groupMatches.map(m => ({
    id: m.id,
    status: 'FINISHED',
    score: { fullTime: { home: 1, away: 0 } },
  }))

  it('includes editable matches within 24h without prediction', () => {
    const urgent = getEliminatoriasReminderMatches({
      knockoutMatches: [match],
      koPreds: {},
      fotmobStandings,
      groupMatches,
      apiMatches,
      now,
    })
    assert.equal(urgent.length, 1)
    assert.equal(urgent[0].home, 'Colombia')
    assert.equal(urgent[0].away, 'Ghana')
    assert.ok(urgent[0].msUntil < ELIMINATORIAS_REMINDER_WINDOW_MS)
  })

  it('skips when prediction is complete', () => {
    const urgent = getEliminatoriasReminderMatches({
      knockoutMatches: [match],
      koPreds: { 'ko-87': { home: 2, away: 1 } },
      fotmobStandings,
      groupMatches,
      apiMatches,
      now,
    })
    assert.equal(urgent.length, 0)
  })

  it('skips matches more than 24h away', () => {
    const urgent = getEliminatoriasReminderMatches({
      knockoutMatches: [{
        ...match,
        utcDate: '2026-07-05T22:00:00Z',
      }],
      koPreds: {},
      fotmobStandings,
      groupMatches,
      apiMatches,
      now,
    })
    assert.equal(urgent.length, 0)
  })

  it('skips dismissed ids', () => {
    const urgent = getEliminatoriasReminderMatches({
      knockoutMatches: [match],
      koPreds: {},
      fotmobStandings,
      groupMatches,
      apiMatches,
      dismissedIds: ['ko-87'],
      now,
    })
    assert.equal(urgent.length, 0)
  })
})
