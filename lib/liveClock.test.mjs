import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLiveClockAnchor, formatSimulatedClock } from './liveClock.js'

test('buildLiveClockAnchor prefers long MM:SS', () => {
  const anchor = buildLiveClockAnchor({ long: '31:04', short: '32’', addedTime: 0 }, null)
  assert.equal(anchor.totalSeconds, 31 * 60 + 4)
})

test('formatSimulatedClock ticks seconds', () => {
  const anchor = buildLiveClockAnchor({ long: '31:04' }, null)
  assert.equal(formatSimulatedClock(anchor, 0).clock, '31:04')
  assert.equal(formatSimulatedClock(anchor, 16).clock, '31:20')
})

test('formatSimulatedClock shows announced stoppage time', () => {
  const anchor = buildLiveClockAnchor({ long: '44:10', addedTime: 3 }, null)
  assert.equal(formatSimulatedClock(anchor, 5).addedTime, '+0:03')
})

test('forward-only: later anchor has higher totalSeconds', () => {
  const a = buildLiveClockAnchor({ long: '31:04' }, null)
  const b = buildLiveClockAnchor({ long: '31:20' }, null)
  assert.ok(b.totalSeconds > a.totalSeconds)
})
