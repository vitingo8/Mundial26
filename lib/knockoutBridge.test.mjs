import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildInicioKnockoutSchedule, inicioKoMatchId } from './knockoutBridge.js'

describe('buildInicioKnockoutSchedule', () => {
  it('returns empty schedule when no group predictions are filled', () => {
    const groupMatches = [
      { id: 'A-0-1', group: 'A', home: 'T1', away: 'T2', utcDate: '2026-06-15T12:00:00Z' },
    ]
    const { schedule, error } = buildInicioKnockoutSchedule(groupMatches, {}, {})
    assert.equal(schedule.length, 0)
    assert.equal(error, null)
  })

  it('builds predicted bracket when at least one group match is filled', () => {
    const letters = 'ABCDEFGHIJKL'.split('')
    const groupMatches = []
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
    const groupPreds = { [groupMatches[0].id]: { home: 2, away: 1 } }
    const { schedule, error } = buildInicioKnockoutSchedule(groupMatches, groupPreds, {})
    assert.equal(error, null)
    assert.ok(schedule.length > 0, 'cuadro previsto visible con marcadores parciales')
    assert.ok(schedule.some(m => m.roundId === 'r32'))
  })

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
    assert.equal(schedule.length, 32, 'dieciseisavos + octavos…final siempre visibles')
    assert.ok(schedule.some(m => m.matchNumber === 89))
    assert.equal(schedule.find(m => m.matchNumber === 89).home, 'G74')

    const preds = {}
    for (const m of schedule) {
      if (m.matchNumber === 74) preds[m.id] = { home: 1, away: 1, advances: 'home' }
      if (m.matchNumber === 77) preds[m.id] = { home: 2, away: 0 }
    }

    const full = buildInicioKnockoutSchedule(groupMatches, groupPreds, preds)
    const m89 = full.schedule.find(m => m.matchNumber === 89)
    assert.ok(m89)
    assert.equal(m89.id, inicioKoMatchId(89))
    assert.notEqual(m89.home, 'G74', 'con marcador, octavos muestran el equipo ganador')
  })
})
