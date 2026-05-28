import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseGroupSlotSource,
  buildActualQualifiersFromApiR32,
  buildPredictedQualifiersFromGroupPreds,
  buildQualificationPointsByTeam,
  lookupQualificationPoints,
  calcQualificationPointsSplit,
  calcGroupQualificationPoints,
} from './groupQualificationScoring.js'
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

  const r = calcGroupQualificationPoints(participant, {
    groupMatches,
    knockoutMatches: apiKo,
  })
  assert.ok(r.ready)
  assert.ok(r.total >= 2)
})
