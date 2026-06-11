import test from 'node:test'
import assert from 'node:assert/strict'
import { migratePredictionMap } from './matchIdMap.js'
import { buildCatalogApiMatches } from './catalogApiMatches.js'
import { enrichApiMatches } from './fifaMatchNumbers.js'
import { transformGroupMatches } from './footballData.js'

test('migratePredictionMap reindexa IDs legacy de football-data.org', () => {
  const catalog = enrichApiMatches(buildCatalogApiMatches())
  const groupMatches = transformGroupMatches(catalog)

  const legacyPreds = {
    537327: { home: 2, away: 1 },
    537328: { home: 0, away: 0 },
  }

  const { migrated, orphans, moved } = migratePredictionMap(legacyPreds, groupMatches)

  assert.equal(orphans.length, 0)
  assert.equal(moved, 2)
  assert.equal(Object.keys(migrated).length, 2)
  assert.equal(migrated['537327'], undefined)
  const ids = Object.keys(migrated)
  assert.ok(ids.every(id => id.startsWith('catalog-')))
  assert.deepEqual(Object.values(migrated), [{ home: 2, away: 1 }, { home: 0, away: 0 }])
})

test('migratePredictionMap conserva IDs canónicos existentes', () => {
  const catalog = enrichApiMatches(buildCatalogApiMatches())
  const groupMatches = transformGroupMatches(catalog)
  const canonId = groupMatches[0].id

  const { migrated, orphans, moved } = migratePredictionMap(
    { [canonId]: { home: 1, away: 1 } },
    groupMatches,
  )

  assert.equal(orphans.length, 0)
  assert.equal(moved, 0)
  assert.deepEqual(migrated, { [canonId]: { home: 1, away: 1 } })
})
