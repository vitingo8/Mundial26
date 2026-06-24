import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseGroupSlotSource,
  buildActualQualifiersFromApiR32,
  buildActualQualifiersFromFotmobStandings,
  buildPredictedQualifiersFromGroupPreds,
  buildQualificationPointsByTeam,
  lookupQualificationPoints,
  calcQualificationPointsSplit,
  calcGroupQualificationPoints,
} from './groupQualificationScoring.js'
import { transformFotmobStandings } from './fotmobStandings.js'
import { generateGroupMatches } from './gameData.js'
import { normalizeTeamName } from './fifaMatchNumbers.js'

test('parseGroupSlotSource', () => {
  assert.deepEqual(parseGroupSlotSource('1A'), { position: 1, groups: ['A'] })
  assert.deepEqual(parseGroupSlotSource('2B'), { position: 2, groups: ['B'] })
  assert.deepEqual(parseGroupSlotSource('3A/B/C/D/F'), {
    position: 3,
    groups: ['A', 'B', 'C', 'D', 'F'],
  })
  assert.equal(parseGroupSlotSource('W73'), null)
})

test('buildActualQualifiersFromApiR32 maps slots to groups', () => {
  const groupMatches = [
    { group: 'A', home: 'España', away: 'Croacia' },
    { group: 'A', home: 'Italia', away: 'Albania' },
    { group: 'B', home: 'Francia', away: 'Alemania' },
  ]
  const apiKo = [
    {
      matchNumber: 73,
      home: 'España',
      away: 'Croacia',
      homeSource: '1A',
      awaySource: '2B',
    },
    {
      matchNumber: 74,
      home: 'Francia',
      away: 'Italia',
      homeSource: '1B',
      awaySource: '3A/B/C/D/F',
    },
  ]
  const { byGroup } = buildActualQualifiersFromApiR32(apiKo, groupMatches)
  assert.equal(byGroup.A[1], 'España')
  assert.equal(byGroup.B[2], 'Croacia')
  assert.equal(byGroup.B[1], 'Francia')
  assert.equal(byGroup.A[3], 'Italia')
})

test('buildActualQualifiersFromApiR32 reads homeTeam.name from FotMob shape', () => {
  const groupMatches = [{ group: 'A', home: 'México', away: 'Sudáfrica' }]
  const apiKo = [{
    matchNumber: 80,
    homeTeam: { name: 'Mexico' },
    awayTeam: { name: '3CEFHI' },
    homeSource: '1A',
    awaySource: '3E/H/I/J/K',
  }]
  const { byGroup, ready } = buildActualQualifiersFromApiR32(apiKo, groupMatches)
  assert.ok(ready)
  assert.equal(byGroup.A[1], 'Mexico')
})

test('buildActualQualifiersFromFotmobStandings uses table positions', () => {
  const fotmobStandings = {
    ready: true,
    resolvedCount: 3,
    byGroup: {
      A: { 1: 'Mexico', 2: 'South Korea', 3: null },
      B: { 1: null, 2: null, 3: null },
      C: { 1: null, 2: null, 3: null },
      D: { 1: null, 2: null, 3: null },
      E: { 1: null, 2: null, 3: null },
      F: { 1: null, 2: null, 3: null },
      G: { 1: null, 2: null, 3: null },
      H: { 1: null, 2: null, 3: null },
      I: { 1: null, 2: null, 3: null },
      J: { 1: null, 2: null, 3: null },
      K: { 1: null, 2: null, 3: null },
      L: { 1: null, 2: null, 3: null },
    },
  }
  const actual = buildActualQualifiersFromFotmobStandings(fotmobStandings)
  assert.ok(actual.ready)
  assert.equal(actual.byGroup.A[1], 'Mexico')
  assert.equal(actual.byGroup.A[2], 'South Korea')
})

test('buildActualQualifiersFromFotmobStandings only counts completed groups', () => {
  const fotmobStandings = {
    ready: true,
    resolvedCount: 4,
    byGroup: {
      ...Object.fromEntries('BCDEFGHIJKL'.split('').map(g => [g, { 1: null, 2: null, 3: null }])),
      A: { 1: 'Mexico', 2: 'South Korea', 3: null },
      B: { 1: 'Canada', 2: 'Switzerland', 3: null },
    },
  }
  const actual = buildActualQualifiersFromFotmobStandings(fotmobStandings, new Set(['A']))
  assert.equal(actual.resolvedCount, 2)
  assert.equal(actual.byGroup.A[1], 'Mexico')
  assert.equal(actual.byGroup.B[1], null)
})

test('calcQualificationPointsSplit: qualify + exact position', () => {
  const predicted = {
    A: { 1: 'España', 2: 'Croacia', 3: null },
    B: { 1: 'Francia', 2: 'Alemania', 3: null },
  }
  const actual = {
    A: { 1: 'España', 2: 'Croacia', 3: null },
    B: { 1: 'Francia', 2: 'Italia', 3: null },
  }
  const r = calcQualificationPointsSplit(predicted, actual)
  // España 1º exacto: 2, Croacia 2º exacto: 2, Francia 1º exacto: 2,
  // Alemania predicho 2º pero no clasifica: 0
  assert.equal(r.qualifies, 3)
  assert.equal(r.exactPosition, 3)
  assert.equal(r.total, 6)
})

test('calcQualificationPointsSplit: passes wrong position gets 1pt only', () => {
  const predicted = {
    A: { 1: 'España', 2: null, 3: 'Croacia' },
  }
  const actual = {
    A: { 1: 'España', 2: 'Croacia', 3: null },
  }
  const r = calcQualificationPointsSplit(predicted, actual)
  // España: 2 pts (1º exacto), Croacia: 1 pt (clasifica pero predijo 3.º)
  assert.equal(r.total, 3)
  assert.equal(r.qualifies, 2)
  assert.equal(r.exactPosition, 1)
})

test('buildQualificationPointsByTeam maps slots by team name', () => {
  const predicted = { A: { 1: 'España', 2: 'Croacia', 3: null } }
  const actual = { A: { 1: 'España', 2: 'Croacia', 3: null } }
  const split = calcQualificationPointsSplit(predicted, actual)
  const empty = buildQualificationPointsByTeam(
    { predictions: { group: {} } },
    { groupMatches: [], knockoutMatches: [] },
  )
  assert.equal(empty.ready, false)
  assert.equal(empty.byTeam.size, 0)
  const byTeam = new Map([
    [normalizeTeamName('España'), { total: 2, qualifiesPts: 1, exactPts: 1, predictedPosition: 1, actualPosition: 1 }],
  ])
  assert.equal(lookupQualificationPoints(byTeam, 'España').total, 2)
  assert.equal(split.total, 4)
})

test('calcGroupQualificationPoints integrates participant', () => {
  const groupMatches = generateGroupMatches({
    A: ['España', 'Croacia', 'Italia', 'Albania'],
    B: ['Francia', 'Alemania', 'Polonia', 'Eslovaquia'],
    C: ['Inglaterra', 'Dinamarca', 'Serbia', 'Eslovenia'],
    D: ['Portugal', 'Turquía', 'Rep. Checa', 'Georgia'],
    E: ['Bélgica', 'Rumanía', 'Ucrania', 'Eslovaquia'],
    F: ['Países Bajos', 'Austria', 'Francia', 'Polonia'],
    G: ['Brasil', 'Suiza', 'Serbia', 'Camerún'],
    H: ['Argentina', 'México', 'Polonia', 'Arabia Saudí'],
    I: ['Uruguay', 'EE.UU.', 'Bolivia', 'Panamá'],
    J: ['Colombia', 'Ecuador', 'Perú', 'Chile'],
    K: ['Japón', 'Corea del Sur', 'Marruecos', 'Croacia'],
    L: ['Australia', 'Túnez', 'Ghana', 'Costa Rica'],
  })

  const groupPreds = {}
  for (const m of groupMatches) {
    if (m.group === 'A' && m.home === 'España') groupPreds[m.id] = { home: 2, away: 0 }
    if (m.group === 'A' && m.home === 'Croacia') groupPreds[m.id] = { home: 2, away: 0 }
    else if (!groupPreds[m.id]) groupPreds[m.id] = { home: 0, away: 0 }
  }

  const participant = {
    predictions: { group: groupPreds },
  }

  const apiKo = [
    {
      matchNumber: 73,
      home: 'España',
      away: 'X',
      homeSource: '1A',
      awaySource: '2B',
    },
  ]

  const fotmobStandings = {
    ready: true,
    resolvedCount: 2,
    byGroup: {
      ...Object.fromEntries('BCDEFGHIJKL'.split('').map(g => [g, { 1: null, 2: null, 3: null }])),
      A: { 1: 'España', 2: 'Croacia', 3: null },
    },
  }

  const apiMatches = groupMatches
    .filter(m => m.group === 'A')
    .map(m => ({
      id: m.id,
      stage: 'GROUP_STAGE',
      group: `GROUP_${m.group}`,
      status: 'FINISHED',
      score: { fullTime: { home: 1, away: 0 } },
    }))

  const r = calcGroupQualificationPoints(participant, {
    groupMatches,
    knockoutMatches: apiKo,
    fotmobStandings,
    apiMatches,
  })
  assert.ok(r.ready)
  assert.ok(r.total >= 2)
  assert.equal(r.actualSource, 'fotmob')
})
