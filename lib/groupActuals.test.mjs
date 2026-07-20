import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isGroupActualsComplete, ACTUALS_FIELDS } from './groupActuals.js'

describe('groupActuals', () => {
  it('ACTUALS_FIELDS has 4 premios', () => {
    assert.equal(ACTUALS_FIELDS.length, 4)
  })

  it('detects complete actuals', () => {
    assert.ok(isGroupActualsComplete({
      topScorer: 'Mbappe',
      topKeeper: 'Unai Simon',
      topAssists: 'Olise',
      mvp: 'Rodrigo',
    }))
  })

  it('detects incomplete actuals', () => {
    assert.ok(!isGroupActualsComplete({}))
    assert.ok(!isGroupActualsComplete({ topScorer: 'Mbappe' }))
  })
})
