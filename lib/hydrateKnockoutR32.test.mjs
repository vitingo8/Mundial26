import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hydrateKnockoutR32FromStandings } from './hydrateKnockoutR32.js'

const thirdStatsByGroup = {
  A: { group: 'A', team: 'South Korea', pts: 3, gd: -1, gf: 2, gc: 3, pj: 3 },
  B: { group: 'B', team: 'Bosnia and Herzegovina', pts: 4, gd: -1, gf: 5, gc: 6, pj: 3 },
  C: { group: 'C', team: 'Scotland', pts: 3, gd: -2, gf: 2, gc: 4, pj: 3 },
  D: { group: 'D', team: 'Paraguay', pts: 4, gd: -2, gf: 2, gc: 4, pj: 3 },
  E: { group: 'E', team: 'Ecuador', pts: 4, gd: 0, gf: 2, gc: 2, pj: 3 },
  F: { group: 'F', team: 'Sweden', pts: 4, gd: 0, gf: 7, gc: 7, pj: 3 },
  G: { group: 'G', team: 'Cape Verde', pts: 2, gd: 0, gf: 2, gc: 2, pj: 2 },
  H: { group: 'H', team: 'Belgium', pts: 2, gd: -1, gf: 1, gc: 2, pj: 2 },
  I: { group: 'I', team: 'DR Congo', pts: 1, gd: -2, gf: 1, gc: 3, pj: 2 },
  J: { group: 'J', team: 'Algeria', pts: 3, gd: 0, gf: 2, gc: 2, pj: 2 },
  K: { group: 'K', team: 'Senegal', pts: 0, gd: -3, gf: 0, gc: 3, pj: 2 },
  L: { group: 'L', team: 'Croatia', pts: 3, gd: 0, gf: 3, gc: 3, pj: 2 },
}

const byGroup = {
  A: { 1: 'Mexico', 2: 'South Africa', 3: 'South Korea' },
  B: { 1: 'Switzerland', 2: 'Canada', 3: 'Bosnia and Herzegovina' },
  C: { 1: 'Brazil', 2: 'Morocco', 3: 'Scotland' },
  D: { 1: 'USA', 2: 'Australia', 3: 'Paraguay' },
  E: { 1: 'Germany', 2: 'Ivory Coast', 3: 'Ecuador' },
  F: { 1: 'Netherlands', 2: 'Japan', 3: 'Sweden' },
  J: { 1: null, 2: null, 3: 'Algeria' },
  L: { 1: null, 2: null, 3: 'Croatia' },
}

const bestThirdsForCombination = [
  { rank: 1, name: 'Sweden', group: 'F', qualifies: true, ...thirdStatsByGroup.F },
  { rank: 2, name: 'Ecuador', group: 'E', qualifies: true, ...thirdStatsByGroup.E },
  { rank: 3, name: 'Bosnia and Herzegovina', group: 'B', qualifies: true, ...thirdStatsByGroup.B },
  { rank: 4, name: 'Paraguay', group: 'D', qualifies: true, ...thirdStatsByGroup.D },
  { rank: 5, name: 'Croatia', group: 'L', qualifies: true, ...thirdStatsByGroup.L },
  { rank: 6, name: 'South Korea', group: 'A', qualifies: true, ...thirdStatsByGroup.A },
  { rank: 7, name: 'Algeria', group: 'J', qualifies: true, ...thirdStatsByGroup.J },
  { rank: 8, name: 'Scotland', group: 'C', qualifies: true, ...thirdStatsByGroup.C },
  { rank: 9, name: 'Cape Verde', group: 'G', qualifies: false, ...thirdStatsByGroup.G },
  { rank: 10, name: 'Belgium', group: 'H', qualifies: false, ...thirdStatsByGroup.H },
  { rank: 11, name: 'DR Congo', group: 'I', qualifies: false, ...thirdStatsByGroup.I },
  { rank: 12, name: 'Senegal', group: 'K', qualifies: false, ...thirdStatsByGroup.K },
]

const fotmobStandings = {
  ready: true,
  thirdStatsByGroup,
  byGroup,
  bestThirds: bestThirdsForCombination,
}

function catalogForLetters(letters) {
  const groupMatches = []
  for (const letter of letters) {
    for (let i = 0; i < 6; i++) {
      groupMatches.push({
        id: `${letter}-${i}`,
        group: letter,
        home: `H${letter}${i}`,
        away: `A${letter}${i}`,
      })
    }
  }
  return groupMatches
}

function finishedGroupApiMatches(letters) {
  return catalogForLetters(letters).map(m => ({
    id: m.id,
    status: 'FINISHED',
    score: { fullTime: { home: 1, away: 0 } },
  }))
}

describe('hydrateKnockoutR32 bracket prompt cases', () => {
  it('shows USA vs Bosnia; Ecuador not in a concrete match', () => {
    const groupMatches = catalogForLetters('ABCDEF')
    const apiMatches = finishedGroupApiMatches('ABCDEF')
    const hydrated = hydrateKnockoutR32FromStandings([], fotmobStandings, groupMatches, apiMatches)

    const m81 = hydrated.find(m => m.matchNumber === 81)
    const m80 = hydrated.find(m => m.matchNumber === 80)
    const m79 = hydrated.find(m => m.matchNumber === 79)
    const m82 = hydrated.find(m => m.matchNumber === 82)

    assert.equal(m81.home, 'Estados Unidos')
    assert.equal(m81.away, 'Bosnia y Herzegovina')
    assert.equal(m81.pendingThirdMatch, false)

    assert.equal(m80.home, '1L')
    assert.equal(m80.away, '3E/H/I/J/K')
    assert.equal(m80.pendingThirdMatch, true)

    assert.equal(m79.away, '3C/E/F/H/I')
    assert.notEqual(m79.away, 'Ecuador')
    assert.notEqual(m82.away, 'Corea del Sur')
  })
})

describe('buildThirdPlaceAssignmentsFromFotmob', () => {
  it('maps combination ABCDEFJL when 8 thirds are known', async () => {
    const { buildThirdPlaceAssignmentsFromFotmob } = await import('./hydrateKnockoutR32.js')
    const assignments = buildThirdPlaceAssignmentsFromFotmob(fotmobStandings, catalogForLetters('ABCDEF'))
    assert.equal(assignments[81], 'B')
    assert.equal(assignments[80], 'E')
  })
})

describe('open group locked 1st/2nd', () => {
  it('shows Argentina as 1J when group J is not finished but 1st is confirmed', () => {
    const openGroupStandings = {
      ready: true,
      thirdStatsByGroup,
      byGroup: {
        ...byGroup,
        J: { 1: 'Argentina', 2: 'Austria', 3: 'Algeria' },
      },
      bestThirds: bestThirdsForCombination,
    }
    const groupJMatches = [
      { id: 'j1', group: 'J', home: 'Argentina', away: 'Algeria' },
      { id: 'j2', group: 'J', home: 'Austria', away: 'Jordan' },
      { id: 'j3', group: 'J', home: 'Argentina', away: 'Austria' },
      { id: 'j4', group: 'J', home: 'Jordan', away: 'Algeria' },
      { id: 'j5', group: 'J', home: 'Algeria', away: 'Austria' },
      { id: 'j6', group: 'J', home: 'Jordan', away: 'Argentina' },
    ]
    const groupMatches = [...catalogForLetters('ABCDEF'), ...groupJMatches, ...catalogForLetters('GHIKL')]
    const apiMatches = [
      ...finishedGroupApiMatches('ABCDEF'),
      { id: 'j1', status: 'FINISHED', score: { fullTime: { home: 3, away: 0 } } },
      { id: 'j2', status: 'FINISHED', score: { fullTime: { home: 3, away: 1 } } },
      { id: 'j3', status: 'FINISHED', score: { fullTime: { home: 2, away: 0 } } },
      { id: 'j4', status: 'FINISHED', score: { fullTime: { home: 1, away: 2 } } },
      { id: 'j5', status: 'SCHEDULED' },
      { id: 'j6', status: 'SCHEDULED' },
      ...catalogForLetters('GHIKL').map(m => ({ id: m.id, status: 'SCHEDULED' })),
    ]
    const hydrated = hydrateKnockoutR32FromStandings([], openGroupStandings, groupMatches, apiMatches)
    const m86 = hydrated.find(m => m.matchNumber === 86)
    assert.equal(m86.home, 'Argentina')
    assert.equal(m86.away, '2H')
  })
})
