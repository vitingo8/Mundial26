import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveFifaMatchNumber,
  formatFifaMatchLabel,
  teamsMatch,
  enrichMatch,
  enrichApiMatches,
} from './fifaMatchNumbers.js'

describe('fifaMatchNumbers', () => {
  it('formatFifaMatchLabel', () => {
    assert.equal(formatFifaMatchLabel(2), 'Partido 2')
    assert.equal(formatFifaMatchLabel(84), 'Partido 84')
  })

  it('resolves group stage by teams', () => {
    const n = resolveFifaMatchNumber({
      stage: 'GROUP_STAGE',
      group: 'A',
      home: 'Mexico',
      away: 'South Africa',
    })
    assert.equal(n, 1)
  })

  it('resolves dieciseisavos by team groups when date is ambiguous', () => {
    const n = resolveFifaMatchNumber({
      stage: 'LAST_32',
      home: 'Colombia',
      away: 'Ghana',
      utcDate: '2026-07-04T01:30:00Z',
    })
    assert.equal(n, 87)
  })

  it('resolves Argentina vs Cape Verde to slot 86 not 87', () => {
    const n = resolveFifaMatchNumber({
      stage: 'LAST_32',
      home: 'Argentina',
      away: 'Cape Verde',
      utcDate: '2026-07-03T22:00:00Z',
    })
    assert.equal(n, 86)
  })

  it('teamsMatch aliases', () => {
    assert.ok(teamsMatch('South Korea', 'Korea Republic'))
    assert.ok(teamsMatch('USA', 'United States'))
  })

  it('enrichMatch adds label', () => {
    const m = enrichMatch({
      stage: 'GROUP_STAGE',
      group: 'D',
      home: 'United States',
      away: 'Paraguay',
    })
    assert.equal(m.matchNumber, 4)
    assert.equal(m.fifaMatchLabel, 'Partido 4')
  })

  it('desambigua octavos del mismo día por recinto (89 vs 90)', () => {
    const n89 = resolveFifaMatchNumber({
      stage: 'LAST_16',
      utcDate: '2026-07-04T19:00:00Z',
      venue: 'Lincoln Financial Field',
    })
    const n90 = resolveFifaMatchNumber({
      stage: 'LAST_16',
      utcDate: '2026-07-04T23:00:00Z',
      venue: 'NRG Stadium',
    })
    assert.equal(n89, 89)
    assert.equal(n90, 90)
  })

  it('enrichApiMatches no deja dos partidos de eliminatorias con el mismo número', () => {
    const matches = enrichApiMatches([
      { id: '1', stage: 'LAST_16', utcDate: '2026-07-04T19:00:00Z', home: 'Canada', away: 'Morocco' },
      { id: '2', stage: 'LAST_16', utcDate: '2026-07-04T23:00:00Z', home: 'Paraguay', away: 'France' },
    ])
    const numbers = matches.map(m => m.matchNumber).filter(n => n != null)
    assert.equal(numbers.length, new Set(numbers).size)
  })

  it('desambigua octavos sin recinto por el equipo real (89 Paraguay-Francia vs 90 Canadá-Marruecos)', () => {
    // Caso real: la API (fotmob) no da recinto (venue: null), así que fecha/recinto no
    // bastan para distinguir 89 de 90 (misma plantilla de fecha). Debe resolverse por quién
    // ganó realmente los dieciseisavos 73 (Canadá), 74 (Paraguay), 75 (Marruecos), 77 (Francia).
    const r32 = [
      {
        id: 'r73', stage: 'LAST_32', venue: null,
        homeTeam: { name: 'South Africa' }, awayTeam: { name: 'Canada' },
        score: { winner: 'AWAY_TEAM' },
      },
      {
        id: 'r74', stage: 'LAST_32', venue: null,
        homeTeam: { name: 'Germany' }, awayTeam: { name: 'Paraguay' },
        score: { winner: 'DRAW', penaltyShootoutWinner: 'away' },
      },
      {
        id: 'r75', stage: 'LAST_32', venue: null,
        homeTeam: { name: 'Netherlands' }, awayTeam: { name: 'Morocco' },
        score: { winner: 'DRAW', penaltyShootoutWinner: 'away' },
      },
      {
        id: 'r77', stage: 'LAST_32', venue: null,
        homeTeam: { name: 'France' }, awayTeam: { name: 'Sweden' },
        score: { winner: 'HOME_TEAM' },
      },
    ]
    const r16 = [
      {
        id: 'ko89', stage: 'LAST_16', venue: null, utcDate: '2026-07-04T21:00:00Z',
        homeTeam: { name: 'Paraguay' }, awayTeam: { name: 'France' },
        score: { winner: 'AWAY_TEAM' },
      },
      {
        id: 'ko90', stage: 'LAST_16', venue: null, utcDate: '2026-07-04T17:00:00Z',
        homeTeam: { name: 'Canada' }, awayTeam: { name: 'Morocco' },
        score: { winner: 'AWAY_TEAM' },
      },
    ]
    const enriched = enrichApiMatches([...r32, ...r16])
    const byId = Object.fromEntries(enriched.map(m => [m.id, m]))
    assert.equal(byId.ko89.matchNumber, 89)
    assert.equal(byId.ko90.matchNumber, 90)
  })

  it('desambigua cuartos sin recinto por el equipo real (99 vs 100, mismo día)', () => {
    const r16 = [
      {
        id: 'ko91', stage: 'LAST_16', venue: null, matchNumber: 91,
        homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Norway' },
        score: { winner: 'HOME_TEAM' },
      },
      {
        id: 'ko92', stage: 'LAST_16', venue: null, matchNumber: 92,
        homeTeam: { name: 'Mexico' }, awayTeam: { name: 'England' },
        score: { winner: 'AWAY_TEAM' },
      },
      {
        id: 'ko95', stage: 'LAST_16', venue: null, matchNumber: 95,
        homeTeam: { name: 'USA' }, awayTeam: { name: 'Belgium' },
        score: { winner: 'HOME_TEAM' },
      },
      {
        id: 'ko96', stage: 'LAST_16', venue: null, matchNumber: 96,
        homeTeam: { name: 'Argentina' }, awayTeam: { name: 'Egypt' },
        score: { winner: 'HOME_TEAM' },
      },
    ]
    const qf = [
      {
        id: 'qf99', stage: 'QUARTER_FINALS', venue: null, utcDate: '2026-07-11T16:00:00Z',
        homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Mexico' },
        score: { winner: null },
      },
      {
        id: 'qf100', stage: 'QUARTER_FINALS', venue: null, utcDate: '2026-07-11T20:00:00Z',
        homeTeam: { name: 'USA' }, awayTeam: { name: 'Argentina' },
        score: { winner: null },
      },
    ]
    const enriched = enrichApiMatches([...r16, ...qf])
    const byId = Object.fromEntries(enriched.map(m => [m.id, m]))
    assert.equal(byId.qf99.matchNumber, 99)
    assert.equal(byId.qf100.matchNumber, 100)
  })
})
