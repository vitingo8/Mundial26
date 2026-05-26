import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcMatchPoints,
  calcLeaderboard,
  leaderboardTiebreak,
  getOutcome,
} from './gameData.js'

describe('calcMatchPoints', () => {
  it('awards outcome + exact', () => {
    const pts = calcMatchPoints({ home: 2, away: 1 }, { home: 2, away: 1 })
    assert.equal(pts, 5)
  })
  it('awards outcome only', () => {
    const pts = calcMatchPoints({ home: 1, away: 0 }, { home: 2, away: 1 })
    assert.equal(pts, 3)
  })
})

describe('leaderboardTiebreak', () => {
  it('prefers higher total', () => {
    assert.ok(leaderboardTiebreak({ total: 10, groupPts: 0, knockoutPts: 0 }, { total: 5, groupPts: 0, knockoutPts: 0 }) < 0)
  })
})

describe('calcLeaderboard', () => {
  it('sorts by weighted total', () => {
    const group = {
      results: { group: { m1: { home: 1, away: 0 } }, knockout: {} },
      actuals: {},
      participants: {
        a: { id: 'a', name: 'A', predictions: { group: { m1: { home: 1, away: 0 } }, knockout: {} }, updated_at: '2026-01-02' },
        b: { id: 'b', name: 'B', predictions: { group: { m1: { home: 0, away: 0 } }, knockout: {} }, updated_at: '2026-01-01' },
      },
    }
    const lb = calcLeaderboard(group)
    assert.equal(lb[0].id, 'a')
  })
})

describe('getOutcome', () => {
  it('detects draw', () => {
    assert.equal(getOutcome(1, 1), 'D')
  })
})
