import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeMatchPoints, buildPublishedResultsMap } from './matchPointsDisplay.js'

describe('matchPointsDisplay', () => {
  it('summarizeMatchPoints — exacto', () => {
    const s = summarizeMatchPoints({ home: 2, away: 1 }, { home: 2, away: 1 })
    assert.equal(s.pts, 8)
    assert.match(s.detail, /1X2/)
    assert.match(s.detail, /exacto/)
  })

  it('buildPublishedResultsMap separa inicio-ko', () => {
    const results = {
      group: { '537327': { home: 1, away: 0 } },
      knockout: { 'inicio-ko-73': { home: 1, away: 1 }, '999': { home: 2, away: 0 } },
    }
    const g = buildPublishedResultsMap(results, 'group')
    assert.ok(g['537327'])
    assert.ok(g['inicio-ko-73'])
    assert.equal(g['999'], undefined)
    const k = buildPublishedResultsMap(results, 'knockout')
    assert.ok(k['999'])
    assert.equal(k['inicio-ko-73'], undefined)
  })
})
