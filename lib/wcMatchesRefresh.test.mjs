import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getWcMatchesPollIntervalMs,
  hasLiveWcMatches,
  hasUpcomingWcMatchesSoon,
} from './wcMatchesRefresh.js'

test('hasLiveWcMatches detects in-play', () => {
  assert.equal(hasLiveWcMatches([{ status: 'SCHEDULED' }]), false)
  assert.equal(hasLiveWcMatches([{ status: 'IN_PLAY' }]), true)
  assert.equal(hasLiveWcMatches([{ status: 'PAUSED' }]), true)
})

test('hasUpcomingWcMatchesSoon within window', () => {
  const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const later = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
  assert.equal(
    hasUpcomingWcMatchesSoon([{ status: 'TIMED', utcDate: soon }]),
    true,
  )
  assert.equal(
    hasUpcomingWcMatchesSoon([{ status: 'TIMED', utcDate: later }]),
    false,
  )
})

test('getWcMatchesPollIntervalMs adapts to context', () => {
  assert.equal(getWcMatchesPollIntervalMs([], { visible: false }), null)
  assert.equal(getWcMatchesPollIntervalMs([{ status: 'IN_PLAY' }]), 12_000)
  const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  assert.equal(
    getWcMatchesPollIntervalMs([{ status: 'TIMED', utcDate: soon }]),
    60_000,
  )
  assert.equal(getWcMatchesPollIntervalMs([{ status: 'FINISHED' }]), 5 * 60_000)
})
