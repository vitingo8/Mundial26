import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { KnockoutBracketError } from './dist/errors.js'
import {
  buildThirdPlaceCombinationKey,
  generateRoundOf32,
  getQualifiedTeams,
  rankThirdPlacedTeams,
  resolveTeamSource,
} from './dist/index.js'

function buildSyntheticGroups() {
  const letters = 'ABCDEFGHIJKL'.split('')
  const groups = {}

  const thirdRank = {
    A: { pts: 6, gd: 2, gf: 9 },
    C: { pts: 6, gd: 1, gf: 8 },
    D: { pts: 5, gd: 0, gf: 7 },
    F: { pts: 4, gd: 1, gf: 6 },
    G: { pts: 4, gd: 0, gf: 5 },
    H: { pts: 3, gd: 2, gf: 4 },
    I: { pts: 3, gd: 1, gf: 3 },
    J: { pts: 3, gd: 0, gf: 2 },
    B: { pts: 1, gd: -5 },
    E: { pts: 1, gd: -4 },
    K: { pts: 1, gd: -3 },
    L: { pts: 1, gd: -2 },
  }

  for (const g of letters) {
    const tr = thirdRank[g]
    groups[g] = [
      { group: g, position: 1, team: `Winner ${g}`, pts: 9, pj: 3, gd: 5 },
      { group: g, position: 2, team: `Runner ${g}`, pts: 6, pj: 3, gd: 1 },
      {
        group: g,
        position: 3,
        team: `Third ${g}`,
        pts: tr.pts,
        pj: 3,
        gd: tr.gd,
        gf: tr.gf,
      },
      { group: g, position: 4, team: `Fourth ${g}`, pts: 0, pj: 3, gd: -3 },
    ]
  }

  return groups
}

const partialBracket = [
  { match: 74, home: '1E', away: '3A/B/C/D/F' },
  { match: 75, home: '1F', away: '2C' },
  { match: 79, home: '1A', away: '3C/E/F/H/I' },
]

const comboMap = {
  ACDFGHIJ: { 74: 'C', 79: 'F' },
}

describe('getQualifiedTeams', () => {
  it('extracts winners, runners-up and third-placed', () => {
    const q = getQualifiedTeams(buildSyntheticGroups())
    assert.equal(q.winners.length, 12)
    assert.equal(q.runnersUp.length, 12)
    assert.equal(q.thirdPlaced.length, 12)
    assert.equal(q.bestThirdPlaced.length, 8)
    assert.equal(q.winners.find(e => e.group === 'E')?.team.name, 'Winner E')
  })
})

describe('rankThirdPlacedTeams', () => {
  it('orders by pts, gd, gf', () => {
    const { thirdPlaced } = getQualifiedTeams(buildSyntheticGroups())
    const ranked = rankThirdPlacedTeams(thirdPlaced)
    assert.deepEqual(
      ranked.slice(0, 4).map(e => e.group),
      ['A', 'C', 'D', 'F'],
    )
  })
})

describe('buildThirdPlaceCombinationKey', () => {
  it('sorts group letters alphabetically', () => {
    const { bestThirdPlaced } = getQualifiedTeams(buildSyntheticGroups())
    assert.equal(buildThirdPlaceCombinationKey(bestThirdPlaced), 'ACDFGHIJ')
  })
})

describe('resolveTeamSource', () => {
  it('resolves 1E, 2C and third with assignment', () => {
    const qualified = getQualifiedTeams(buildSyntheticGroups())
    const assignments = { 74: 'C' }

    assert.equal(resolveTeamSource('1E', qualified, assignments, 74).team.name, 'Winner E')
    assert.equal(resolveTeamSource('2C', qualified, assignments, 75).team.name, 'Runner C')
    const third = resolveTeamSource('3A/B/C/D/F', qualified, assignments, 74)
    assert.equal(third.team.name, 'Third C')
    assert.equal(third.resolvedGroup, 'C')
  })
})

describe('generateRoundOf32', () => {
  it('builds matches from combination table', () => {
    const result = generateRoundOf32(buildSyntheticGroups(), partialBracket, comboMap)
    assert.equal(result.combinationKey, 'ACDFGHIJ')
    const m74 = result.matches.find(m => m.matchNumber === 74)
    assert.equal(m74.homeTeam.name, 'Winner E')
    assert.equal(m74.awayTeam.name, 'Third C')
  })

  it('errors when combination is missing', () => {
    assert.throws(
      () => generateRoundOf32(buildSyntheticGroups(), partialBracket, {}),
      e =>
        e instanceof KnockoutBracketError &&
        e.message === 'No hay asignación de mejores terceros para la combinación ACDFGHIJ.',
    )
  })

  it('errors when assigned group is not allowed', () => {
    assert.throws(
      () => generateRoundOf32(buildSyntheticGroups(), partialBracket, { ACDFGHIJ: { 74: 'G' } }),
      e => e instanceof KnockoutBracketError && e.message.includes('no está permitido'),
    )
  })

  it('errors when a third-placed group is used twice', () => {
    assert.throws(
      () =>
        generateRoundOf32(buildSyntheticGroups(), partialBracket, {
          ACDFGHIJ: { 74: 'C', 79: 'C' },
        }),
      e => e instanceof KnockoutBracketError && e.message.includes('más de una vez'),
    )
  })
})
