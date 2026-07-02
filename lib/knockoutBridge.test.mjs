import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEliminatoriasKnockoutSchedule,
  buildInicioKnockoutSchedule,
  filterApiKnockoutR32,
  inicioKoMatchId,
  knockoutRealKoMatchId,
} from './knockoutBridge.js'
import { buildLiveKnockoutMatches } from './hydrateKnockoutR32.js'

describe('buildInicioKnockoutSchedule', () => {
  it('returns empty schedule when no group predictions are filled', () => {
    const groupMatches = [
      { id: 'A-0-1', group: 'A', home: 'T1', away: 'T2', utcDate: '2026-06-15T12:00:00Z' },
    ]
    const { schedule, error } = buildInicioKnockoutSchedule(groupMatches, {}, {})
    assert.equal(schedule.length, 0)
    assert.equal(error, null)
  })

  it('builds predicted bracket when at least one group match is filled', () => {
    const letters = 'ABCDEFGHIJKL'.split('')
    const groupMatches = []
    for (const g of letters) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          groupMatches.push({
            id: `${g}-${i}-${j}`,
            group: g,
            home: `T${g}${i}`,
            away: `T${g}${j}`,
            utcDate: '2026-06-15T12:00:00Z',
          })
        }
      }
    }
    const groupPreds = { [groupMatches[0].id]: { home: 2, away: 1 } }
    const { schedule, error } = buildInicioKnockoutSchedule(groupMatches, groupPreds, {})
    assert.equal(error, null)
    assert.ok(schedule.length > 0, 'cuadro previsto visible con marcadores parciales')
    assert.ok(schedule.some(m => m.roundId === 'r32'))
  })

  it('extends to later rounds when r32 scores are set', () => {
    const groupMatches = []
    const letters = 'ABCDEFGHIJKL'.split('')
    for (const g of letters) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          groupMatches.push({
            id: `${g}-${i}-${j}`,
            group: g,
            home: `T${g}${i}`,
            away: `T${g}${j}`,
            utcDate: '2026-06-15T12:00:00Z',
          })
        }
      }
    }

    const groupPreds = {}
    for (const m of groupMatches) {
      groupPreds[m.id] = { home: 2, away: 1 }
    }

    const { schedule, error } = buildInicioKnockoutSchedule(groupMatches, groupPreds, {})
    assert.equal(error, null)
    assert.equal(schedule.length, 32, 'dieciseisavos + octavos…final siempre visibles')
    assert.ok(schedule.some(m => m.matchNumber === 89))
    assert.equal(schedule.find(m => m.matchNumber === 89).home, 'G74')

    const preds = {}
    for (const m of schedule) {
      if (m.matchNumber === 74) preds[m.id] = { home: 1, away: 1, advances: 'home' }
      if (m.matchNumber === 77) preds[m.id] = { home: 2, away: 0 }
    }

    const full = buildInicioKnockoutSchedule(groupMatches, groupPreds, preds)
    const m89 = full.schedule.find(m => m.matchNumber === 89)
    assert.ok(m89)
    assert.equal(m89.id, inicioKoMatchId(89))
    assert.notEqual(m89.home, 'G74', 'con marcador, octavos muestran el equipo ganador')
  })
})

describe('buildEliminatoriasKnockoutSchedule', () => {
  const apiR32 = [
    {
      id: 'api-74',
      matchNumber: 74,
      roundId: 'r32',
      home: 'España',
      away: 'Austria',
      homeCrest: null,
      awayCrest: null,
      utcDate: '2026-06-28T19:00:00Z',
    },
    {
      id: 'api-89',
      matchNumber: 89,
      roundId: 'r16',
      home: 'TBD',
      away: 'TBD',
      utcDate: '2026-07-04T19:00:00Z',
    },
  ]

  it('filterApiKnockoutR32 keeps only dieciseisavos', () => {
    const r32 = filterApiKnockoutR32(apiR32)
    assert.equal(r32.length, 1)
    assert.equal(r32[0].matchNumber, 74)
  })

  it('uses API id for r32 and knockout-ko for later rounds without API id', () => {
    const schedule = buildEliminatoriasKnockoutSchedule(apiR32, {})
    const m74 = schedule.find(m => m.matchNumber === 74)
    const m89 = schedule.find(m => m.matchNumber === 89)
    assert.equal(m74.id, 'api-74')
    assert.equal(m74.isPredictedBracket, false)
    assert.equal(m89.id, 'api-89')
    assert.equal(m89.isPredictedBracket, true)
  })

  it('octavos teams come from API when both sides are resolved', () => {
    const api = [
      ...apiR32.filter(m => m.matchNumber !== 89),
      {
        id: 'api-89',
        matchNumber: 89,
        roundId: 'r16',
        home: 'España',
        away: 'Francia',
        utcDate: '2026-07-04T19:00:00Z',
      },
    ]
    const schedule = buildEliminatoriasKnockoutSchedule(api, {})
    const m89 = schedule.find(m => m.matchNumber === 89)
    assert.ok(m89)
    assert.equal(m89.home, 'España')
    assert.equal(m89.away, 'Francia')
    assert.equal(m89.isPredictedBracket, false)
  })

  it('octavos stay as placeholders until API defines both teams', () => {
    const preds = {
      'api-74': { home: 2, away: 0 },
    }
    const schedule = buildEliminatoriasKnockoutSchedule(apiR32, preds)
    const m89 = schedule.find(m => m.matchNumber === 89)
    assert.ok(m89)
    assert.notEqual(m89.home, 'España')
    assert.equal(m89.isPredictedBracket, true)
  })

  it('matches En vivo schedule for home/away on each match number', () => {
    const schedule = buildEliminatoriasKnockoutSchedule(apiR32, {}, {
      fotmobStandings: null,
      groupMatches: [],
      apiMatches: [],
    })
    const live = buildLiveKnockoutMatches(apiR32, null, [], [])
    assert.equal(schedule.length, live.length)
    for (const liveMatch of live) {
      const porraMatch = schedule.find(m => m.matchNumber === liveMatch.matchNumber)
      assert.ok(porraMatch, `missing match ${liveMatch.matchNumber}`)
      assert.equal(porraMatch.home, liveMatch.home)
      assert.equal(porraMatch.away, liveMatch.away)
    }
  })
})
