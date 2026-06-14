import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLiveClockAnchor, formatSimulatedClock, isLiveClockPaused } from './liveClock.js'

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

test('isLiveClockPaused stops clock at HT even with stale minute', () => {
  assert.equal(isLiveClockPaused('PAUSED', null), true)
  assert.equal(isLiveClockPaused('IN_PLAY', { short: 'HT' }), true)
  assert.equal(isLiveClockPaused('IN_PLAY', { short: 'MT' }), true)
  assert.equal(isLiveClockPaused('IN_PLAY', { short: '45\'' }), false)
  assert.equal(buildLiveClockAnchor({ short: 'HT' }, 45), null)
})
