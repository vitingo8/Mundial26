import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  lookupEliminatoriasKoPred,
  lookupBracketPred,
  knockoutRealKoMatchId,
  inicioKoMatchId,
} from './knockoutBridge.js'
import { migratePredictionMap } from './matchIdMap.js'

describe('lookupEliminatoriasKoPred', () => {
  const match = { id: '4653712', matchNumber: 78 }

  it('finds pred by API id', () => {
    const preds = { 4653712: { home: 2, away: 1 } }
    assert.deepEqual(lookupEliminatoriasKoPred(preds, match), { home: 2, away: 1 })
  })

  it('falls back to knockout-ko-N', () => {
    const preds = { [knockoutRealKoMatchId(78)]: { home: 1, away: 0 } }
    assert.deepEqual(lookupEliminatoriasKoPred(preds, match), { home: 1, away: 0 })
  })

  it('prefers API id over legacy key', () => {
    const preds = {
      4653712: { home: 2, away: 1 },
      [knockoutRealKoMatchId(78)]: { home: 0, away: 0 },
    }
    assert.deepEqual(lookupEliminatoriasKoPred(preds, match), { home: 2, away: 1 })
  })
})

describe('lookupBracketPred', () => {
  it('uses inicio lookup for inicio-ko ids', () => {
    const match = { id: inicioKoMatchId(89), matchNumber: 89 }
    const preds = { [inicioKoMatchId(89)]: { home: 1, away: 2 } }
    assert.deepEqual(lookupBracketPred(preds, match), { home: 1, away: 2 })
  })

  it('uses eliminatorias lookup for API r32 ids', () => {
    const match = { id: '4653712', matchNumber: 78 }
    const preds = { [knockoutRealKoMatchId(78)]: { home: 3, away: 2 } }
    assert.deepEqual(lookupBracketPred(preds, match), { home: 3, away: 2 })
  })
})

describe('migratePredictionMap knockout-ko keys', () => {
  it('reindexes knockout-ko-N to API id for r32', () => {
    const knockoutMatches = [
      { id: '4653712', matchNumber: 78, home: 'A', away: 'B' },
      { id: '4653717', matchNumber: 85, home: 'C', away: 'D' },
    ]
    const { migrated, orphans, moved } = migratePredictionMap(
      {
        'knockout-ko-78': { home: 2, away: 1 },
        'knockout-ko-85': { home: 1, away: 0 },
        'knockout-ko-undefined': { home: 3, away: 1 },
      },
      knockoutMatches,
    )

    assert.equal(orphans.length, 1)
    assert.equal(orphans[0], 'knockout-ko-undefined')
    assert.equal(moved, 2)
    assert.deepEqual(migrated['4653712'], { home: 2, away: 1 })
    assert.deepEqual(migrated['4653717'], { home: 1, away: 0 })
    assert.equal(migrated['knockout-ko-78'], undefined)
    assert.equal(migrated['knockout-ko-85'], undefined)
  })

  it('keeps API id when both legacy and API keys exist', () => {
    const knockoutMatches = [{ id: '4653712', matchNumber: 78, home: 'A', away: 'B' }]
    const { migrated } = migratePredictionMap(
      {
        4653712: { home: 2, away: 1 },
        'knockout-ko-78': { home: 9, away: 9 },
      },
      knockoutMatches,
    )
    assert.deepEqual(migrated['4653712'], { home: 2, away: 1 })
    assert.equal(migrated['knockout-ko-78'], undefined)
  })
})
