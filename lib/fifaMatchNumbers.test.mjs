import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveFifaMatchNumber,
  formatFifaMatchLabel,
  teamsMatch,
  enrichMatch,
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
})
