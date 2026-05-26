import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeGroupStandings,
  computeMiniStats,
  sortTeamsByFifaTiebreak,
} from './groupStandings.js'

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

test('desempate FIFA — dos equipos: manda el enfrentamiento directo', () => {
  const ms = [
    { id: '1', home: 'A', away: 'B' },
    { id: '2', home: 'A', away: 'C' },
    { id: '3', home: 'B', away: 'C' },
  ]
  const preds = {
    1: { home: 1, away: 0 },
    2: { home: 0, away: 5 },
    3: { home: 5, away: 0 },
  }
  const tied = [
    { name: 'A', pts: 3, gf: 1, gc: 5, dg: -4 },
    { name: 'B', pts: 3, gf: 5, gc: 1, dg: 4 },
  ]
  const sorted = sortTeamsByFifaTiebreak(tied, ms, preds)
  assert.deepEqual(sorted.map(t => t.name), ['A', 'B'])
})

test('desempate FIFA — tres equipos: mini-liga antes que DG global', () => {
  const ms = [
    { id: '1', home: 'A', away: 'B' },
    { id: '2', home: 'B', away: 'C' },
    { id: '3', home: 'C', away: 'A' },
    { id: '4', home: 'A', away: 'D' },
    { id: '5', home: 'B', away: 'D' },
    { id: '6', home: 'C', away: 'D' },
  ]
  const preds = {
    1: { home: 3, away: 0 },
    2: { home: 2, away: 0 },
    3: { home: 1, away: 0 },
    4: { home: 1, away: 1 },
    5: { home: 1, away: 1 },
    6: { home: 1, away: 1 },
  }
  const groups = computeGroupStandings(
    ms.map(m => ({ ...m, group: 'X', homeCrest: null, awayCrest: null, utcDate: '2026-06-11T12:00:00Z' })),
    preds,
  )
  const top3 = groups[0].teams.slice(0, 3).map(t => t.name)
  assert.deepEqual(top3, ['A', 'B', 'C'])
})

test('desempate FIFA — segundo paso: DG global si la mini-liga empata', () => {
  const three = [
    { id: '1', group: 'D', home: 'X', away: 'Y', utcDate: '2026-06-11T12:00:00Z' },
    { id: '2', group: 'D', home: 'Y', away: 'Z', utcDate: '2026-06-12T12:00:00Z' },
    { id: '3', group: 'D', home: 'Z', away: 'X', utcDate: '2026-06-13T12:00:00Z' },
    { id: '4', group: 'D', home: 'X', away: 'W', utcDate: '2026-06-14T12:00:00Z' },
    { id: '5', group: 'D', home: 'Y', away: 'W', utcDate: '2026-06-15T12:00:00Z' },
    { id: '6', group: 'D', home: 'Z', away: 'W', utcDate: '2026-06-16T12:00:00Z' },
  ]
  const preds = {
    1: { home: 1, away: 1 },
    2: { home: 1, away: 1 },
    3: { home: 1, away: 1 },
    4: { home: 3, away: 0 },
    5: { home: 1, away: 0 },
    6: { home: 0, away: 0 },
  }
  const groups = computeGroupStandings(three, preds)
  const order = groups[0].teams.slice(0, 3).map(t => t.name)
  assert.deepEqual(order, ['X', 'Y', 'Z'])
})

test('computeMiniStats — solo cuenta partidos entre empatados', () => {
  const ms = [
    { id: '1', home: 'A', away: 'B' },
    { id: '2', home: 'A', away: 'C' },
  ]
  const mini = computeMiniStats(['A', 'B'], ms, {
    1: { home: 2, away: 0 },
    2: { home: 5, away: 0 },
  })
  assert.equal(mini.A.pts, 3)
  assert.equal(mini.B.pts, 0)
  assert.equal(mini.C, undefined)
})
