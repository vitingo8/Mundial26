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

test('migración IDs Bosnia-H. (football-data abreviado)', async () => {
  const data = await getWcMatchesSafe()
  const groupMatches = transformGroupMatches(data.matches || [])
  const legacyPreds = {
    537333: { home: 2, away: 0 },
    537335: { home: 1, away: 1 },
    537338: { home: 0, away: 0 },
  }

  const { migrated, orphans } = migratePredictionMap(legacyPreds, groupMatches)
  assert.equal(orphans.length, 0)
  assert.deepEqual(migrated['4667757'], { home: 2, away: 0 })
  assert.deepEqual(migrated['4667759'], { home: 1, away: 1 })
  assert.deepEqual(migrated['4667762'], { home: 0, away: 0 })
})

test('migración IDs Turquía (537346/347/349)', async () => {
  const data = await getWcMatchesSafe()
  const groupMatches = transformGroupMatches(data.matches || [])
  const legacyPreds = {
    537346: { home: 1, away: 3 },
    537347: { home: 2, away: 1 },
    537349: { home: 1, away: 1 },
  }

  const { migrated, orphans } = migratePredictionMap(legacyPreds, groupMatches)
  assert.equal(orphans.length, 0)
  assert.deepEqual(migrated['4667772'], { home: 1, away: 3 })
  assert.deepEqual(migrated['4667773'], { home: 2, away: 1 })
  assert.deepEqual(migrated['4667775'], { home: 1, away: 1 })
})

test('migración IDs catalog-N (partido 6 Turquía)', async () => {
  const data = await getWcMatchesSafe()
  const groupMatches = transformGroupMatches(data.matches || [])
  const { migrated, orphans } = migratePredictionMap(
    { 'catalog-6': { home: 0, away: 2 } },
    groupMatches,
  )
  assert.equal(orphans.length, 0)
  assert.deepEqual(migrated['4667772'], { home: 0, away: 2 })
})

test('migración Turquía sin matchNumber (solo huella equipos + fecha desfasada)', async () => {
  const data = await getWcMatchesSafe()
  const groupMatches = transformGroupMatches(data.matches || []).map(m =>
    m.matchNumber === 6 ? { ...m, matchNumber: undefined } : m,
  )

  const { migrated, orphans } = migratePredictionMap(
    { 537346: { home: 2, away: 0 } },
    groupMatches,
  )
  assert.equal(orphans.length, 0)
  assert.deepEqual(migrated['4667772'], { home: 2, away: 0 })
})

test('countOrphanPredKeys devuelve 0 antes de cargar calendario', () => {
  assert.equal(countOrphanPredKeys({ '537327': { home: 1, away: 0 } }, []), 0)
})
