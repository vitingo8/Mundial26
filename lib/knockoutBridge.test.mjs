import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildInicioKnockoutSchedule, inicioKoMatchId } from './knockoutBridge.js'

describe('buildInicioKnockoutSchedule', () => {
  it('extends to later rounds when r32 scores are set', () => {
    const groupMatches = []
    const letters = 'ABCDEFGHIJKL'.split('')
    for (const g of letters) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          groupMatches.push({
            id: `${g}-${i}-${j}`,
            group: g,
            home: `T${g}${i}`,
            away: `T${g}${j}`,
            utcDate: '2026-06-15T12:00:00Z',
          })
        }
      }
    }

    const groupPreds = {}
    for (const m of groupMatches) {
      groupPreds[m.id] = { home: 2, away: 1 }
    }

    const { schedule, error } = buildInicioKnockoutSchedule(groupMatches, groupPreds, {})
    assert.equal(error, null)
    assert.equal(schedule.length, 16)

    const preds = {}
    for (const m of schedule) {
      if (m.matchNumber === 74) preds[m.id] = { home: 3, away: 1 }
      if (m.matchNumber === 77) preds[m.id] = { home: 2, away: 0 }
    }

    const full = buildInicioKnockoutSchedule(groupMatches, groupPreds, preds)
    assert.ok(full.schedule.some(m => m.matchNumber === 89))
    assert.equal(full.schedule.find(m => m.matchNumber === 89).id, inicioKoMatchId(89))
  })
})
