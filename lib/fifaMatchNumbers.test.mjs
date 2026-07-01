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
})
