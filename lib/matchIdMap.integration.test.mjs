import test from 'node:test'
import assert from 'node:assert/strict'
import { getWcMatchesSafe } from './fotmobServerCache.js'
import { transformGroupMatches } from './footballData.js'
import { migratePredictionMap, countOrphanPredKeys } from './matchIdMap.js'
import legacyFootballDataIds from './legacyFootballDataIds.json' with { type: 'json' }

test('FotMob calendario resuelve los 72 partidos de grupos', async () => {
  const data = await getWcMatchesSafe()
  const groupMatches = transformGroupMatches(data.matches || [])
  assert.equal(groupMatches.length, 72)
  assert.equal(groupMatches.filter(m => m.matchNumber != null).length, 72)
})

test('migración completa de IDs legacy football-data.org sin huérfanos', async () => {
  const data = await getWcMatchesSafe()
  const groupMatches = transformGroupMatches(data.matches || [])
  const legacyPreds = {}
  for (const [id, matchNumber] of Object.entries(legacyFootballDataIds)) {
    if (matchNumber <= 72) legacyPreds[id] = { home: 1, away: 0 }
  }

  const { migrated, orphans, moved } = migratePredictionMap(legacyPreds, groupMatches)
  assert.equal(orphans.length, 0)
  assert.equal(moved, Object.keys(legacyPreds).length)
  assert.equal(Object.keys(migrated).length, Object.keys(legacyPreds).length)
  assert.ok(Object.keys(migrated).every(id => !legacyFootballDataIds[id]))
})

test('countOrphanPredKeys devuelve 0 antes de cargar calendario', () => {
  assert.equal(countOrphanPredKeys({ '537327': { home: 1, away: 0 } }, []), 0)
})
