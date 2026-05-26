import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getWcCatalogKickoffs,
  isCatalogMatchSessionOpen,
  shouldWakeSyncFromCatalog,
} from './wcKickoffCatalog.js'

describe('wcKickoffCatalog', () => {
  it('tiene 104 pitidos en catálogo', () => {
    const k = getWcCatalogKickoffs()
    assert.equal(k.length, 104)
    assert.ok(k[0].utcDate)
    assert.equal(k[0].matchNumber, 1)
  })

  it('sesión abierta desde el pitido', () => {
    const kickoff = '2026-06-11T19:00:00Z'
    assert.equal(
      isCatalogMatchSessionOpen(kickoff, new Date('2026-06-11T18:59:00Z')),
      false,
    )
    assert.equal(
      isCatalogMatchSessionOpen(kickoff, new Date('2026-06-11T19:00:00Z')),
      true,
    )
    assert.equal(
      isCatalogMatchSessionOpen(kickoff, new Date('2026-06-11T20:30:00Z')),
      true,
    )
  })

  it('sesión cerrada horas después del partido', () => {
    const kickoff = '2026-06-11T19:00:00Z'
    assert.equal(
      isCatalogMatchSessionOpen(kickoff, new Date('2026-06-12T02:00:00Z')),
      false,
    )
  })

  it('shouldWakeSyncFromCatalog con partido 1', () => {
    const now = new Date('2026-06-11T19:05:00Z')
    assert.equal(shouldWakeSyncFromCatalog(now), true)
  })
})
