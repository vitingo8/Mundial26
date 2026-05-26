import test from 'node:test'
import assert from 'node:assert/strict'
import { computeGroupStandings } from './groupStandings.js'

const matches = [
  { id: '1', group: 'A', home: 'Uruguay', away: 'Egipto', homeCrest: null, awayCrest: null, utcDate: '2026-06-11T18:00:00Z' },
  { id: '2', group: 'A', home: 'Polonia', away: 'Indonesia', homeCrest: null, awayCrest: null, utcDate: '2026-06-12T18:00:00Z' },
  { id: '3', group: 'A', home: 'Uruguay', away: 'Polonia', homeCrest: null, awayCrest: null, utcDate: '2026-06-17T18:00:00Z' },
]

test('computeGroupStandings — sin marcadores, todos a cero', () => {
  const groups = computeGroupStandings(matches, {})
  assert.equal(groups.length, 1)
  assert.equal(groups[0].id, 'A')
  assert.equal(groups[0].teams.length, 4)
  groups[0].teams.forEach(t => {
    assert.equal(t.pts, 0)
    assert.equal(t.pj, 0)
  })
})

test('computeGroupStandings — victoria y empate', () => {
  const preds = {
    1: { home: 2, away: 0 },
    2: { home: 1, away: 1 },
  }
  const groups = computeGroupStandings(matches, preds)
  const byName = Object.fromEntries(groups[0].teams.map(t => [t.name, t]))

  assert.equal(byName.Uruguay.pts, 3)
  assert.equal(byName.Uruguay.gf, 2)
  assert.equal(byName.Uruguay.pj, 1)
  assert.equal(byName.Polonia.pts, 1)
  assert.equal(byName.Polonia.gf, 1)
  assert.equal(byName['Indonesia'].pts, 1)
})

test('computeGroupStandings — orden por puntos y DG', () => {
  const preds = {
    1: { home: 2, away: 0 },
    2: { home: 3, away: 0 },
    3: { home: 0, away: 2 },
  }
  const groups = computeGroupStandings(matches, preds)
  assert.equal(groups[0].teams[0].name, 'Polonia')
  assert.equal(groups[0].teams[1].name, 'Uruguay')
})
