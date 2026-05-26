import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fromMadridDatetimeLocal,
  toMadridDatetimeLocalValue,
  formatMadridDateTime,
} from './madridTime.js'

test('verano CEST: 20:00 Madrid → 18:00 UTC', () => {
  const iso = fromMadridDatetimeLocal('2026-06-15T20:00')
  assert.equal(iso, '2026-06-15T18:00:00.000Z')
})

test('invierno CET: 20:00 Madrid → 19:00 UTC', () => {
  const iso = fromMadridDatetimeLocal('2026-01-15T20:00')
  assert.equal(iso, '2026-01-15T19:00:00.000Z')
})

test('roundtrip datetime-local', () => {
  const local = '2026-07-10T23:59'
  const iso = fromMadridDatetimeLocal(local)
  assert.equal(toMadridDatetimeLocalValue(iso), local)
})

test('format en Madrid', () => {
  const s = formatMadridDateTime('2026-06-15T18:00:00.000Z')
  assert.match(s, /15/)
  assert.match(s, /20/)
})
