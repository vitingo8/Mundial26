import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEliminatoriasMatchEditable,
  isEliminatoriasMatchLocked,
} from './eliminatoriasMatchLock.js'

describe('eliminatoriasMatchLock', () => {
  const kickoffFuture = new Date('2026-07-01T12:00:00Z')
  const kickoffPast = new Date('2026-06-01T12:00:00Z')

  it('allows edit when both teams are resolved and kickoff is in the future', () => {
    const match = {
      home: 'España',
      away: 'Francia',
      utcDate: '2026-07-04T19:00:00Z',
    }
    assert.equal(isEliminatoriasMatchEditable(match, { now: kickoffFuture }), true)
    assert.equal(isEliminatoriasMatchLocked(match, { now: kickoffFuture }), false)
  })

  it('locks when either team is still a FIFA placeholder', () => {
    const match = {
      home: 'W74',
      away: 'Francia',
      utcDate: '2026-07-04T19:00:00Z',
    }
    assert.equal(isEliminatoriasMatchEditable(match, { now: kickoffFuture }), false)
  })

  it('locks after kickoff', () => {
    const match = {
      home: 'España',
      away: 'Francia',
      utcDate: '2026-05-01T19:00:00Z',
    }
    assert.equal(isEliminatoriasMatchEditable(match, { now: kickoffPast }), false)
  })

  it('locks when phase is closed', () => {
    const match = {
      home: 'España',
      away: 'Francia',
      utcDate: '2026-07-04T19:00:00Z',
    }
    assert.equal(isEliminatoriasMatchEditable(match, { phaseLocked: true }), false)
  })

  it('locks when a third-place slot is still pending', () => {
    const match = {
      home: 'España',
      away: '3E',
      utcDate: '2026-07-04T19:00:00Z',
      homePendingThird: false,
      awayPendingThird: true,
    }
    assert.equal(isEliminatoriasMatchEditable(match), false)
  })
})
