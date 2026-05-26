import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergePredictions, summarizePredictions } from './predictionMirror.js'

describe('predictionMirror', () => {
  it('fillGaps keeps existing and adds empty slots', () => {
    const target = {
      group: { m1: { home: 1, away: 0 } },
      knockout: {},
      bonuses: { topScorer: 'A', topKeeper: '', topAssists: '', mvp: '' },
    }
    const source = {
      group: { m1: { home: 9, away: 9 }, m2: { home: 2, away: 2 } },
      knockout: { k1: { home: 1, away: 1 } },
      bonuses: { topScorer: 'B', topKeeper: 'C', topAssists: '', mvp: '' },
    }
    const merged = mergePredictions(target, source, 'fillGaps')
    assert.deepEqual(merged.group.m1, { home: 1, away: 0 })
    assert.deepEqual(merged.group.m2, { home: 2, away: 2 })
    assert.deepEqual(merged.knockout.k1, { home: 1, away: 1 })
    assert.equal(merged.bonuses.topScorer, 'A')
    assert.equal(merged.bonuses.topKeeper, 'C')
  })

  it('replace uses source entirely', () => {
    const target = { group: { m1: { home: 1, away: 0 } } }
    const source = { group: { m2: { home: 3, away: 3 } } }
    const merged = mergePredictions(target, source, 'replace')
    assert.deepEqual(merged.group, { m2: { home: 3, away: 3 } })
  })

  it('summarize counts filled entries', () => {
    const s = summarizePredictions({
      group: { a: { home: 1, away: 1 }, b: { home: '', away: '' } },
      knockout: {},
      bonuses: { topScorer: 'X', topKeeper: '', topAssists: '', mvp: '' },
    })
    assert.equal(s.group, 1)
    assert.equal(s.bonuses, 1)
    assert.equal(s.total, 2)
  })
})
