import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hydrateKnockoutR32FromStandings,
  inferThirdPlaceAssignmentsFromR32,
} from './hydrateKnockoutR32.js'
import { buildBracketRounds } from './knockoutBracketDisplay.js'
import { isResolvedTeamName } from './knockoutMatchScoring.js'

const fotmobStandings = {
  ready: true,
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
    J: { 1: null, 2: null, 3: null },
    K: { 1: null, 2: null, 3: null },
    L: { 1: null, 2: null, 3: null },
  },
}

describe('hydrateKnockoutR32FromStandings', () => {
  it('resolves 1st/2nd places for completed groups A–F', () => {
    const groupMatches = [
      { id: 'ga', group: 'A', home: 'Mexico', away: 'South Africa', homeCrest: 'a.png', awayCrest: 'b.png' },
      { id: 'gb', group: 'B', home: 'Switzerland', away: 'Canada' },
      { id: 'gc', group: 'C', home: 'Brazil', away: 'Morocco' },
      { id: 'gd', group: 'D', home: 'USA', away: 'Australia' },
      { id: 'ge', group: 'E', home: 'Germany', away: 'Ivory Coast' },
      { id: 'gf', group: 'F', home: 'Netherlands', away: 'Japan' },
    ]
    const apiMatches = groupMatches.map(m => ({
      id: m.id,
      status: 'FINISHED',
      score: { fullTime: { home: 1, away: 0 } },
    }))
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

  it('shows more than 7 resolved teams in R32 bracket for groups A–F', () => {
    const groupMatches = []
    for (const letter of 'ABCDEF') {
      for (let i = 0; i < 6; i++) {
        groupMatches.push({
          id: `${letter}-${i}`,
          group: letter,
          home: `Team ${letter}H${i}`,
          away: `Team ${letter}A${i}`,
        })
      }
    }
    const apiMatches = groupMatches.map(m => ({
      id: m.id,
      status: 'FINISHED',
      score: { fullTime: { home: 1, away: 0 } },
    }))
    const hydrated = hydrateKnockoutR32FromStandings([], fotmobStandings, groupMatches, apiMatches)
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
    const byGroup = fotmobStandings.byGroup
    const groupMatches = [
      { group: 'C', home: 'Brazil', away: 'Morocco' },
      { group: 'C', home: 'Scotland', away: 'Brazil' },
    ]
    const assignments = inferThirdPlaceAssignmentsFromR32(r32, groupMatches, byGroup)
    assert.equal(assignments[79], 'C')
  })
})
