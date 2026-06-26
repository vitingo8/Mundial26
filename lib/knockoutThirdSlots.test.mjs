import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildThirdPlaceQualificationContext,
  calculateMathematicalQualificationStatus,
  compareThirdPlaceStats,
} from './thirdPlaceQualification.js'
import {
  buildQualifiedThirdsPendingList,
  isBracketSlotResolvedForGroup,
  isThirdQualified,
  resolveThirdSideDisplay,
} from './knockoutThirdSlots.js'
import {
  hydrateKnockoutR32FromStandings,
} from './hydrateKnockoutR32.js'

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
  G: { 1: null, 2: null, 3: 'Cape Verde' },
  H: { 1: null, 2: null, 3: 'Belgium' },
  I: { 1: null, 2: null, 3: 'DR Congo' },
  J: { 1: null, 2: null, 3: 'Algeria' },
  K: { 1: null, 2: null, 3: 'Senegal' },
  L: { 1: null, 2: null, 3: 'Croatia' },
}

const fotmobStandings = {
  ready: true,
  thirdStatsByGroup,
  byGroup,
  bestThirds: Object.values(thirdStatsByGroup).map((row, i) => ({
    rank: i + 1,
    name: row.team,
    qualifies: i < 8,
    ...row,
  })),
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

function scenarioCtx() {
  const groupMatches = catalogForLetters('ABCDEF')
  const apiMatches = finishedGroupApiMatches('ABCDEF')
  return buildThirdPlaceQualificationContext(fotmobStandings, groupMatches, apiMatches, byGroup)
}

describe('third place mathematical qualification', () => {
  it('South Korea: pending, not qualified, not in bracket', () => {
    const ctx = scenarioCtx()
    const sk = ctx.teamStates.A
    assert.equal(sk.qualificationStatus, 'pending')
    assert.equal(sk.bracketSlotResolved, false)
    assert.equal(isThirdQualified('A', ctx), false)

    const side74 = resolveThirdSideDisplay('3A/B/C/D/F', 74, ctx)
    assert.equal(side74.team, null)
    assert.notEqual(side74.team, 'South Korea')

    const side82 = resolveThirdSideDisplay('3A/E/H/I/J', 82, ctx)
    assert.equal(side82.team, null)
    assert.equal(isBracketSlotResolvedForGroup('A', 82, ctx.viableCombinationKeys, ctx), false)
  })

  it('Bosnia: qualified and assigned to match 81', () => {
    const ctx = scenarioCtx()
    const bosnia = ctx.teamStates.B
    assert.equal(bosnia.qualificationStatus, 'qualified')
    assert.equal(bosnia.bracketSlotResolved, true)
    assert.equal(bosnia.resolvedMatchId, 81)
    assert.equal(bosnia.resolvedOpponent, '1D')

    const side = resolveThirdSideDisplay('3B/E/F/I/J', 81, ctx)
    assert.equal(side.bracketSlotResolved, true)
    assert.equal(side.team, 'Bosnia and Herzegovina')
  })

  it('Ecuador: qualified but bracket slot not resolved', () => {
    const ctx = scenarioCtx()
    const ecuador = ctx.teamStates.E
    assert.equal(ecuador.qualificationStatus, 'qualified')
    assert.equal(ecuador.bracketSlotResolved, false)

    const side = resolveThirdSideDisplay('3E/H/I/J/K', 80, ctx)
    assert.equal(side.qualified, true)
    assert.equal(side.bracketSlotResolved, false)
    assert.equal(side.team, null)

    const pending = buildQualifiedThirdsPendingList(ctx)
    assert.ok(pending.some(row => row.group === 'E'))
  })

  it('does not assign by slot compatibility alone (3A in P74)', () => {
    const ctx = scenarioCtx()
    assert.ok('3A/B/C/D/F'.includes('A'))
    assert.equal(ctx.teamStates.A.group, 'A')
    assert.notEqual(ctx.teamStates.A.qualificationStatus, 'qualified')
    assert.equal(ctx.teamStates.A.bracketSlotResolved, false)
  })
})

describe('third placement resolution (knockoutThirdSlots)', () => {
  it('Bosnia: qualified and bracket slot fixed on P81', () => {
    const ctx = scenarioCtx()
    assert.equal(isThirdQualified('B', ctx), true)
    assert.equal(isBracketSlotResolvedForGroup('B', 81, ctx.viableCombinationKeys, ctx), true)

    const side = resolveThirdSideDisplay('3B/E/F/I/J', 81, ctx)
    assert.equal(side.bracketSlotResolved, true)
    assert.equal(side.team, 'Bosnia and Herzegovina')
  })

  it('South Korea is not placed on P82 despite being 3A', () => {
    const ctx = scenarioCtx()
    const side = resolveThirdSideDisplay('3A/E/H/I/J', 82, ctx)
    assert.equal(side.bracketSlotResolved, false)
    assert.equal(side.team, null)
  })
})

describe('hydrateKnockoutR32 bracket prompt cases', () => {
  it('shows USA vs Bosnia; Ecuador and South Korea not in concrete matches', () => {
    const groupMatches = catalogForLetters('ABCDEF')
    const apiMatches = finishedGroupApiMatches('ABCDEF')
    const hydrated = hydrateKnockoutR32FromStandings([], fotmobStandings, groupMatches, apiMatches)

    const m81 = hydrated.find(m => m.matchNumber === 81)
    const m80 = hydrated.find(m => m.matchNumber === 80)
    const m82 = hydrated.find(m => m.matchNumber === 82)

    assert.equal(m81.home, 'Estados Unidos')
    assert.equal(m81.away, 'Bosnia y Herzegovina')
    assert.equal(m81.pendingThirdMatch, false)

    assert.equal(m80.away, '3E/H/I/J/K')
    assert.notEqual(m80.away, 'Ecuador')

    assert.notEqual(m82.away, 'Corea del Sur')
    assert.notEqual(m82.away, 'South Korea')
  })
})

describe('compareThirdPlaceStats', () => {
  it('orders by pts then gd then gf', () => {
    const a = { group: 'A', pts: 4, gd: 0, gf: 2, fairPlay: 0 }
    const b = { group: 'B', pts: 4, gd: 0, gf: 7, fairPlay: 0 }
    assert.ok(compareThirdPlaceStats(b, a) < 0)
  })
})
