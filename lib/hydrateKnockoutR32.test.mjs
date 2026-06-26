import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildThirdPlaceAssignmentsFromFotmob,
  hydrateKnockoutR32FromStandings,
  inferThirdPlaceAssignmentsFromR32,
} from './hydrateKnockoutR32.js'
import { buildBracketRounds } from './knockoutBracketDisplay.js'
import { isResolvedTeamName } from './knockoutMatchScoring.js'

const bestThirds = [
  { rank: 1, name: 'Sweden', qualifies: true },
  { rank: 2, name: 'Ecuador', qualifies: true },
  { rank: 3, name: 'Bosnia and Herzegovina', qualifies: true },
  { rank: 4, name: 'Paraguay', qualifies: true },
  { rank: 5, name: 'Croatia', qualifies: true },
  { rank: 6, name: 'South Korea', qualifies: true },
  { rank: 7, name: 'Algeria', qualifies: true },
  { rank: 8, name: 'Scotland', qualifies: true },
]

const fotmobStandings = {
  ready: true,
  bestThirds,
  byGroup: {
    A: { 1: 'Mexico', 2: 'South Africa', 3: 'South Korea' },
    B: { 1: 'Switzerland', 2: 'Canada', 3: 'Bosnia and Herzegovina' },
    C: { 1: 'Brazil', 2: 'Morocco', 3: 'Scotland' },
    D: { 1: 'USA', 2: 'Australia', 3: 'Paraguay' },
    E: { 1: 'Germany', 2: 'Ivory Coast', 3: 'Ecuador' },
    F: { 1: 'Netherlands', 2: 'Japan', 3: 'Sweden' },
    G: { 1: null, 2: null, 3: null },
    H: { 1: null, 2: null, 3: null },
    I: { 1: null, 2: null, 3: null },
    J: { 1: null, 2: null, 3: 'Algeria' },
    K: { 1: null, 2: null, 3: null },
    L: { 1: null, 2: null, 3: 'Croatia' },
  },
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

const thirdLookupGroupMatches = [
  ...catalogForLetters('ABCDEF'),
  { group: 'A', home: 'Mexico', away: 'South Korea' },
  { group: 'B', home: 'Bosnia and Herzegovina', away: 'Canada' },
  { group: 'C', home: 'Scotland', away: 'Brazil' },
  { group: 'D', home: 'USA', away: 'Paraguay' },
  { group: 'E', home: 'Germany', away: 'Ecuador' },
  { group: 'F', home: 'Netherlands', away: 'Sweden' },
  { group: 'J', home: 'Algeria', away: 'Team J' },
  { group: 'L', home: 'Croatia', away: 'Team L' },
]

describe('buildThirdPlaceAssignmentsFromFotmob', () => {
  it('maps combination ABCDEFJL to official match slots', () => {
    const assignments = buildThirdPlaceAssignmentsFromFotmob(fotmobStandings, thirdLookupGroupMatches)
    assert.equal(assignments[79], 'C')
    assert.equal(assignments[80], 'E')
    assert.equal(assignments[81], 'B')
    assert.equal(assignments[87], 'L')
  })
})

describe('hydrateKnockoutR32FromStandings', () => {
  it('resolves 1st/2nd places for completed groups A–F', () => {
    const groupMatches = catalogForLetters('ABCDEF')
    const apiMatches = finishedGroupApiMatches('ABCDEF')
    const knockoutMatches = [
      {
        id: '9001',
        matchNumber: 73,
        homeSource: '2A',
        awaySource: '2B',
        home: 'South Africa',
        away: 'Canada',
        stage: 'LAST_32',
      },
      {
        id: '9002',
        matchNumber: 75,
        homeSource: '1F',
        awaySource: '2C',
        home: '1F',
        away: 'Morocco',
        stage: 'LAST_32',
      },
    ]

    const hydrated = hydrateKnockoutR32FromStandings(
      knockoutMatches,
      fotmobStandings,
      groupMatches,
      apiMatches,
    )
    const m73 = hydrated.find(m => m.matchNumber === 73)
    const m75 = hydrated.find(m => m.matchNumber === 75)
    const m76 = hydrated.find(m => m.matchNumber === 76)

    assert.equal(m73.home, 'Sudáfrica')
    assert.equal(m73.away, 'Canadá')
    assert.equal(m75.home, 'Países Bajos')
    assert.equal(m75.away, 'Marruecos')
    assert.equal(m76.home, 'Brasil')
    assert.equal(m76.away, 'Japón')
  })

  it('assigns confirmed thirds via FIFA combination (USA vs Bosnia, Mexico vs Scotland)', () => {
    const groupMatches = catalogForLetters('ABCDEF')
    const apiMatches = finishedGroupApiMatches('ABCDEF')
    const knockoutMatches = [
      {
        id: '9079',
        matchNumber: 79,
        homeSource: '1A',
        awaySource: '3C/E/F/H/I',
        home: 'Netherlands',
        away: 'Morocco',
        homeCrest: 'wrong-home.png',
        awayCrest: 'morocco.png',
        stage: 'LAST_32',
      },
      {
        id: '9081',
        matchNumber: 81,
        homeSource: '1D',
        awaySource: '3B/E/F/I/J',
        home: 'USA',
        away: '1G',
        stage: 'LAST_32',
      },
    ]

    const hydrated = hydrateKnockoutR32FromStandings(
      knockoutMatches,
      fotmobStandings,
      groupMatches,
      apiMatches,
    )
    const m79 = hydrated.find(m => m.matchNumber === 79)
    const m81 = hydrated.find(m => m.matchNumber === 81)

    assert.equal(m79.home, 'México')
    assert.equal(m79.away, 'Escocia')
    assert.notEqual(m79.awayCrest, 'morocco.png')
    assert.equal(m81.home, 'Estados Unidos')
    assert.equal(m81.away, 'Bosnia y Herzegovina')
  })

  it('keeps FIFA slot for incomplete groups (1J, 1K) and drops wrong API crests', () => {
    const groupMatches = catalogForLetters('ABCDEFJK')
    const apiMatches = finishedGroupApiMatches('ABCDEF')
    const knockoutMatches = [
      {
        id: '9086',
        matchNumber: 86,
        homeSource: '1J',
        awaySource: '2H',
        home: 'Argentina',
        homeCrest: 'arg.png',
        away: '2H',
        stage: 'LAST_32',
      },
      {
        id: '9087',
        matchNumber: 87,
        homeSource: '1K',
        awaySource: '3D/E/I/J/L',
        home: 'Argentina',
        homeCrest: 'arg.png',
        away: '2H',
        stage: 'LAST_32',
      },
    ]

    const hydrated = hydrateKnockoutR32FromStandings(
      knockoutMatches,
      fotmobStandings,
      groupMatches,
      apiMatches,
    )
    const m86 = hydrated.find(m => m.matchNumber === 86)
    const m87 = hydrated.find(m => m.matchNumber === 87)

    assert.equal(m86.home, '1J')
    assert.equal(m86.homeCrest, null)
    assert.equal(m87.home, '1K')
    assert.equal(m87.homeCrest, null)
    assert.equal(m87.away, '3D/E/I/J/L')
  })

  it('hides third name when group is still open (Algeria on P85)', () => {
    const groupMatches = catalogForLetters('ABCDEF')
    const apiMatches = finishedGroupApiMatches('ABCDEF')
    const hydrated = hydrateKnockoutR32FromStandings([], fotmobStandings, groupMatches, apiMatches)
    const m85 = hydrated.find(m => m.matchNumber === 85)
    assert.equal(m85.home, 'Suiza')
    assert.equal(m85.away, '3E/F/G/I/J')
  })

  it('shows more than 7 resolved teams in R32 bracket for groups A–F', () => {
    const groupMatches = catalogForLetters('ABCDEF')
    const apiMatches = finishedGroupApiMatches('ABCDEF')
    const standings = { ...fotmobStandings, bestThirds: [] }
    const hydrated = hydrateKnockoutR32FromStandings([], standings, groupMatches, apiMatches)
    const rounds = buildBracketRounds(hydrated)
    const r32 = rounds.find(r => r.id === 'r32')
    const resolved = new Set()
    for (const m of r32.matches) {
      if (isResolvedTeamName(m.home)) resolved.add(m.home)
      if (isResolvedTeamName(m.away)) resolved.add(m.away)
    }
    assert.ok(resolved.size >= 12, `expected >=12 teams, got ${resolved.size}: ${[...resolved].join(', ')}`)
  })
})

describe('inferThirdPlaceAssignmentsFromR32', () => {
  it('reads third group from resolved API side', () => {
    const r32 = [{
      matchNumber: 79,
      homeSource: '1A',
      awaySource: '3C/E/F/H/I',
      home: 'Mexico',
      away: 'Scotland',
    }]
    const assignments = inferThirdPlaceAssignmentsFromR32(r32, thirdLookupGroupMatches, fotmobStandings.byGroup)
    assert.equal(assignments[79], 'C')
  })
})
