import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeMatchPoints, buildPublishedResultsMap, resolvePublishedResultForMatch } from './matchPointsDisplay.js'

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

  it('buildPublishedResultsMap añade alias knockout-ko y id API', () => {
    const canonical = [{ id: '4653845', matchNumber: 94, home: 'USA', away: 'Belgium' }]
    const results = {
      knockout: { 'knockout-ko-94': { home: 1, away: 4, matchNumber: 94 } },
    }
    const k = buildPublishedResultsMap(results, 'knockout', canonical)
    assert.deepEqual(k['knockout-ko-94'], { home: 1, away: 4, matchNumber: 94 })
    assert.deepEqual(k['4653845'], { home: 1, away: 4, matchNumber: 94 })
    assert.deepEqual(k['bracket-94'], { home: 1, away: 4, matchNumber: 94 })
  })

  it('resolvePublishedResultForMatch resuelve por bracket id', () => {
    const published = { 'knockout-ko-94': { home: 1, away: 4, matchNumber: 94 } }
    const match = { id: 'bracket-94', matchNumber: 94 }
    assert.deepEqual(resolvePublishedResultForMatch(match, published), { home: 1, away: 4, matchNumber: 94 })
  })
})
