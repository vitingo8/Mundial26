import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  stampPredictionsOnSave,
  stripPredTimestampsForCompare,
  getPredSavedAt,
} from './predictionTimestamps.js'

describe('predictionTimestamps', () => {
  it('añade t al guardar partido nuevo', () => {
    const next = { group: {}, knockout: { '4653710': { home: 2, away: 1 } }, inicioKnockout: {}, bonuses: {} }
    const stamped = stampPredictionsOnSave(next, {}, '2026-07-01T20:00:00.000Z')
    assert.equal(stamped.knockout['4653710'].t, '2026-07-01T20:00:00.000Z')
  })

  it('conserva t si el marcador no cambió', () => {
    const prev = { knockout: { '4653710': { home: 2, away: 1, t: '2026-07-01T19:00:00.000Z' } } }
    const next = { group: {}, knockout: { '4653710': { home: 2, away: 1 } }, inicioKnockout: {}, bonuses: {} }
    const stamped = stampPredictionsOnSave(next, prev, '2026-07-01T20:00:00.000Z')
    assert.equal(stamped.knockout['4653710'].t, '2026-07-01T19:00:00.000Z')
  })

  it('actualiza t si el marcador cambió', () => {
    const prev = { knockout: { '4653710': { home: 2, away: 1, t: '2026-07-01T19:00:00.000Z' } } }
    const next = { group: {}, knockout: { '4653710': { home: 3, away: 1 } }, inicioKnockout: {}, bonuses: {} }
    const stamped = stampPredictionsOnSave(next, prev, '2026-07-01T20:00:00.000Z')
    assert.equal(stamped.knockout['4653710'].t, '2026-07-01T20:00:00.000Z')
  })

  it('stripPredTimestampsForCompare ignora t', () => {
    const a = { knockout: { x: { home: 1, away: 0, t: 'a' } } }
    const b = { knockout: { x: { home: 1, away: 0, t: 'b' } } }
    assert.deepEqual(stripPredTimestampsForCompare(a), stripPredTimestampsForCompare(b))
  })

  it('getPredSavedAt', () => {
    assert.equal(getPredSavedAt({ home: 1, away: 0, t: '2026-07-01T20:00:00.000Z' }), '2026-07-01T20:00:00.000Z')
    assert.equal(getPredSavedAt({ home: 1, away: 0 }), null)
  })
})
