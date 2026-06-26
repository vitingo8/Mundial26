import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SCORING } from './gameData.js'
import {
  buildInicioKnockoutScoringState,
  calcInicioKnockoutPointsSplit,
  findRealKnockoutMatchForPair,
  getInicioKnockoutUiStatus,
  knockoutPairKey,
} from './inicioKnockoutScoring.js'
import { inicioKoMatchId } from './knockoutBridge.js'
import { normalizeTeamName } from './fifaMatchNumbers.js'

describe('inicioKnockoutScoring', () => {
  const participant = {
    predictions: {
      group: {},
      inicioKnockout: {
        [inicioKoMatchId(74)]: { home: 2, away: 1 },
        [inicioKoMatchId(89)]: { home: 1, away: 1, advances: 'home' },
      },
    },
  }

  it('pairKey is order-independent', () => {
    assert.equal(knockoutPairKey('España', 'Austria'), knockoutPairKey('Austria', 'España'))
  })

  it('scores G/E/P when teams met in another slot of the same phase', () => {
    const state = buildInicioKnockoutScoringState(participant, {
      groupMatches: [],
      knockoutMatches: [
        { id: 'api-88', matchNumber: 88, roundId: 'r32', home: 'Austria', away: 'España' },
      ],
      knockoutResults: {
        'api-88': { home: 1, away: 2, matchNumber: 88, homeTeam: 'Austria', awayTeam: 'España' },
      },
    })

    state.inicioPredictedById[inicioKoMatchId(74)] = { home: 'España', away: 'Austria', matchNumber: 74, roundId: 'r32' }

    const split = calcInicioKnockoutPointsSplit(
      { home: 2, away: 1 },
      { home: 'España', away: 'Austria' },
      state,
      74,
    )
    assert.equal(split.gep, SCORING.correctOutcome)
    assert.equal(split.resultado, SCORING.exactScore)
  })

  it('does not score across phases (octavos pred vs final result)', () => {
    const state = {
      pairIndexByRound: {
        final: {
          [knockoutPairKey('España', 'Francia')]: {
            teams: { home: 'Francia', away: 'España' },
            result: { home: 0, away: 1 },
            matchNumber: 104,
            roundId: 'final',
          },
        },
      },
      teamIndexByRound: {},
      actualByMatchNumber: {},
    }
    const split = calcInicioKnockoutPointsSplit(
      { home: 1, away: 0 },
      { home: 'España', away: 'Francia' },
      state,
      89,
    )
    assert.equal(split.gep, 0)
    assert.equal(split.resultado, 0)
  })

  it('no G/E/P when pairing never happened in phase', () => {
    const state = buildInicioKnockoutScoringState(participant, {
      groupMatches: [],
      knockoutMatches: [
        { id: 'api-74', matchNumber: 74, roundId: 'r32', home: 'España', away: 'Alemania' },
      ],
      knockoutResults: {
        'api-74': { home: 2, away: 1, matchNumber: 74, homeTeam: 'España', awayTeam: 'Alemania' },
      },
    })

    state.inicioPredictedById[inicioKoMatchId(74)] = { home: 'España', away: 'Austria', matchNumber: 74, roundId: 'r32' }

    const split = calcInicioKnockoutPointsSplit(
      { home: 2, away: 1 },
      { home: 'España', away: 'Austria' },
      state,
      74,
    )
    assert.equal(split.gep, 0)
    assert.equal(split.resultado, 0)
    assert.equal(split.advance, SCORING.knockoutAdvance)
  })

  it('advance +1 for picked team in same phase regardless of predicted opponent', () => {
    const state = buildInicioKnockoutScoringState(participant, {
      groupMatches: [],
      knockoutMatches: [
        { id: 'api-74', matchNumber: 74, roundId: 'r32', home: 'España', away: 'Alemania' },
      ],
      knockoutResults: {
        'api-74': { home: 2, away: 0, matchNumber: 74, homeTeam: 'España', awayTeam: 'Alemania' },
      },
    })

    state.inicioPredictedById[inicioKoMatchId(74)] = { home: 'España', away: 'Austria', matchNumber: 74, roundId: 'r32' }

    const split = calcInicioKnockoutPointsSplit(
      { home: 2, away: 1 },
      { home: 'España', away: 'Austria' },
      state,
      74,
    )
    assert.equal(split.advance, SCORING.knockoutAdvance)
  })

  it('UI void when real slot has different teams in same phase', () => {
    const state = {
      pairIndexByRound: {
        r32: {
          [knockoutPairKey('España', 'Alemania')]: {
            teams: { home: 'España', away: 'Alemania' },
            matchNumber: 74,
            roundId: 'r32',
            result: { home: 2, away: 1 },
          },
        },
      },
      teamIndexByRound: { r32: {} },
      actualByMatchNumber: {
        74: { home: 'España', away: 'Alemania', roundId: 'r32' },
      },
    }
    const status = getInicioKnockoutUiStatus('España', 'Austria', 74, state)
    assert.equal(status.void, true)
    assert.equal(status.label, '0 pts')
  })

  it('UI not void for future octavos when r32 opponents were wrong but phase not played', () => {
    const state = {
      pairIndexByRound: {
        r32: {
          [knockoutPairKey('Alemania', 'Paraguay')]: {
            teams: { home: 'Alemania', away: 'Paraguay' },
            matchNumber: 74,
            roundId: 'r32',
            result: { home: 3, away: 0 },
          },
          [knockoutPairKey('Francia', 'Marruecos')]: {
            teams: { home: 'Francia', away: 'Marruecos' },
            matchNumber: 79,
            roundId: 'r32',
            result: { home: 2, away: 1 },
          },
        },
        r16: {
          [knockoutPairKey('Alemania', 'Japón')]: {
            teams: { home: 'Alemania', away: 'Japón' },
            matchNumber: 89,
            roundId: 'r16',
          },
        },
      },
      teamIndexByRound: {
        r32: {
          [normalizeTeamName('Alemania')]: [{
            matchNumber: 74,
            roundId: 'r32',
            teams: { home: 'Alemania', away: 'Paraguay' },
            result: { home: 3, away: 0 },
          }],
          [normalizeTeamName('Francia')]: [{
            matchNumber: 79,
            roundId: 'r32',
            teams: { home: 'Francia', away: 'Marruecos' },
            result: { home: 2, away: 1 },
          }],
        },
        r16: {
          [normalizeTeamName('Alemania')]: [{
            matchNumber: 89,
            roundId: 'r16',
            teams: { home: 'Alemania', away: 'Japón' },
          }],
        },
      },
      actualByMatchNumber: {
        74: { home: 'Alemania', away: 'Paraguay', roundId: 'r32' },
        79: { home: 'Francia', away: 'Marruecos', roundId: 'r32' },
        89: { home: 'Alemania', away: 'Japón', roundId: 'r16' },
      },
    }

    assert.equal(getInicioKnockoutUiStatus('Francia', 'Japón', 77, state).void, true)
    const octavos = getInicioKnockoutUiStatus('Alemania', 'Francia', 89, state)
    assert.equal(octavos.void, false)
    assert.equal(octavos.pending, true)
  })

  it('UI void for octavos after both teams finished against other opponents', () => {
    const state = {
      pairIndexByRound: {
        r16: {
          [knockoutPairKey('Alemania', 'Japón')]: {
            teams: { home: 'Alemania', away: 'Japón' },
            matchNumber: 89,
            roundId: 'r16',
            result: { home: 2, away: 0 },
          },
          [knockoutPairKey('Francia', 'Brasil')]: {
            teams: { home: 'Francia', away: 'Brasil' },
            matchNumber: 90,
            roundId: 'r16',
            result: { home: 1, away: 0 },
          },
        },
      },
      teamIndexByRound: {
        r16: {
          [normalizeTeamName('Alemania')]: [{
            matchNumber: 89,
            roundId: 'r16',
            teams: { home: 'Alemania', away: 'Japón' },
            result: { home: 2, away: 0 },
          }],
          [normalizeTeamName('Francia')]: [{
            matchNumber: 90,
            roundId: 'r16',
            teams: { home: 'Francia', away: 'Brasil' },
            result: { home: 1, away: 0 },
          }],
        },
      },
      actualByMatchNumber: {
        89: { home: 'Alemania', away: 'Japón', roundId: 'r16' },
        90: { home: 'Francia', away: 'Brasil', roundId: 'r16' },
      },
    }
    const status = getInicioKnockoutUiStatus('Alemania', 'Francia', 89, state)
    assert.equal(status.void, true)
  })

  it('UI not void when pair meets in final but octavos pred differs', () => {
    const state = {
      pairIndexByRound: {
        final: {
          [knockoutPairKey('España', 'Francia')]: {
            teams: { home: 'Francia', away: 'España' },
            result: { home: 0, away: 1 },
            matchNumber: 104,
            roundId: 'final',
          },
        },
        r16: {},
      },
      teamIndexByRound: { r16: {}, final: {} },
      actualByMatchNumber: {},
    }
    const status = getInicioKnockoutUiStatus('España', 'Francia', 89, state)
    assert.equal(status.void, false)
    assert.equal(status.pending, true)
  })

  it('UI void when both teams already assigned to different r32 slots', () => {
    const state = {
      pairIndexByRound: { r32: {} },
      teamIndexByRound: {
        r32: {
          [normalizeTeamName('Brasil')]: [{
            matchNumber: 76,
            roundId: 'r32',
            teams: { home: 'Brasil', away: 'Japón' },
          }],
          [normalizeTeamName('Países Bajos')]: [{
            matchNumber: 79,
            roundId: 'r32',
            teams: { home: 'Países Bajos', away: 'Marruecos' },
          }],
        },
      },
      actualByMatchNumber: {
        76: { home: 'Brasil', away: 'Japón', roundId: 'r32' },
        79: { home: 'Países Bajos', away: 'Marruecos', roundId: 'r32' },
      },
    }
    const status = getInicioKnockoutUiStatus('Países Bajos', 'Brasil', 75, state)
    assert.equal(status.void, true)
  })

  it('UI void when predicted team already eliminated', () => {
    const state = {
      pairIndexByRound: {
        r32: {
          [knockoutPairKey('Turquía', 'Austria')]: {
            teams: { home: 'Turquía', away: 'Austria' },
            matchNumber: 80,
            roundId: 'r32',
            result: { home: 0, away: 2 },
          },
        },
      },
      teamIndexByRound: {
        r32: {
          [normalizeTeamName('Turquía')]: [{
            matchNumber: 80,
            roundId: 'r32',
            teams: { home: 'Turquía', away: 'Austria' },
            result: { home: 0, away: 2 },
          }],
        },
      },
      actualByMatchNumber: {
        80: { home: 'Turquía', away: 'Austria', roundId: 'r32' },
      },
    }

    assert.equal(getInicioKnockoutUiStatus('Turquía', 'Egipto', 81, state).void, true)
    assert.equal(getInicioKnockoutUiStatus('Turquía', 'Egipto', 89, state).void, true)
  })

  it('UI not void for 3rd place when team lost semifinal', () => {
    const state = {
      pairIndexByRound: {
        sf: {
          [knockoutPairKey('España', 'Francia')]: {
            teams: { home: 'España', away: 'Francia' },
            matchNumber: 101,
            roundId: 'sf',
            result: { home: 1, away: 2 },
          },
        },
      },
      teamIndexByRound: { sf: {} },
      actualByMatchNumber: {},
    }

    const status = getInicioKnockoutUiStatus('España', 'Alemania', 103, state)
    assert.equal(status.void, false)
    assert.equal(status.pending, true)
  })

  it('UI void when predicted team did not qualify from groups', () => {
    const groupMatches = [
      { id: 'g-a-0-1', group: 'A', home: 'Turquía', away: 'Egipto' },
      { id: 'g-a-0-2', group: 'A', home: 'Turquía', away: 'Marruecos' },
      { id: 'g-a-0-3', group: 'A', home: 'Turquía', away: 'Corea del Sur' },
      { id: 'g-a-1-2', group: 'A', home: 'Egipto', away: 'Marruecos' },
      { id: 'g-a-1-3', group: 'A', home: 'Egipto', away: 'Corea del Sur' },
      { id: 'g-a-2-3', group: 'A', home: 'Marruecos', away: 'Corea del Sur' },
    ]
    const groupResults = {
      'g-a-0-1': { home: 0, away: 3 },
      'g-a-0-2': { home: 0, away: 2 },
      'g-a-0-3': { home: 0, away: 2 },
      'g-a-1-2': { home: 2, away: 0 },
      'g-a-1-3': { home: 1, away: 0 },
      'g-a-2-3': { home: 2, away: 1 },
    }
    const state = buildInicioKnockoutScoringState(
      { predictions: { group: {}, inicioKnockout: {} } },
      { groupMatches, knockoutMatches: [], groupResults },
    )

    assert.equal(getInicioKnockoutUiStatus('Turquía', 'Egipto', 74, state).void, true)
    assert.equal(getInicioKnockoutUiStatus('Turquía', 'Egipto', 89, state).void, true)
    assert.equal(getInicioKnockoutUiStatus('Egipto', 'Marruecos', 74, state).void, false)
  })

  it('findRealKnockoutMatchForPair is scoped to phase', () => {
    const state = {
      pairIndexByRound: {
        r16: {
          [knockoutPairKey('España', 'Francia')]: {
            teams: { home: 'Francia', away: 'España' },
            result: { home: 0, away: 1 },
            matchNumber: 92,
            roundId: 'r16',
          },
        },
        final: {
          [knockoutPairKey('España', 'Francia')]: {
            teams: { home: 'Francia', away: 'España' },
            result: { home: 0, away: 2 },
            matchNumber: 104,
            roundId: 'final',
          },
        },
      },
      teamIndexByRound: {},
      actualByMatchNumber: {},
    }
    const r16 = findRealKnockoutMatchForPair('España', 'Francia', state, 89)
    const fin = findRealKnockoutMatchForPair('España', 'Francia', state, 104)
    assert.equal(r16?.matchNumber, 92)
    assert.equal(fin?.matchNumber, 104)
  })
})
