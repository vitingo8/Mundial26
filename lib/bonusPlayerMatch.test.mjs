import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bonusPlayerNamesMatch, normalizePlayerName } from './bonusPlayerMatch.js'

describe('normalizePlayerName', () => {
  it('quita tildes y normaliza espacios', () => {
    assert.equal(normalizePlayerName('  Unai Simón  '), 'unai simon')
    assert.equal(normalizePlayerName('Kylian Mbappé'), 'kylian mbappe')
  })
})

describe('bonusPlayerNamesMatch', () => {
  it('coincidencia exacta con distinto casing', () => {
    assert.ok(bonusPlayerNamesMatch('Mbappe', 'mbappe'))
  })

  it('coincidencia con tildes', () => {
    assert.ok(bonusPlayerNamesMatch('Unai Simón', 'Unai Simon'))
  })

  it('apellido vs nombre completo (goleador)', () => {
    assert.ok(bonusPlayerNamesMatch('Kylian Mbappé', 'Mbappe'))
    assert.ok(bonusPlayerNamesMatch('Mbappe', 'Kylian Mbappé'))
  })

  it('apellido vs nombre completo (asistente)', () => {
    assert.ok(bonusPlayerNamesMatch('Michael Olise', 'Olise'))
    assert.ok(bonusPlayerNamesMatch('Olise', 'Michael Olise'))
  })

  it('apellido vs nombre completo (portero)', () => {
    assert.ok(bonusPlayerNamesMatch('Simon', 'Unai Simon'))
    assert.ok(bonusPlayerNamesMatch('Unai Simon', 'Simon'))
  })

  it('no confunde jugadores distintos', () => {
    assert.ok(!bonusPlayerNamesMatch('Harry Kane', 'Mbappe'))
    assert.ok(!bonusPlayerNamesMatch('Lamine Yamal', 'Rodrigo'))
    assert.ok(!bonusPlayerNamesMatch('Pedri', 'Rodrigo'))
    assert.ok(!bonusPlayerNamesMatch('Joan Garcia', 'Unai Simon'))
  })

  it('ignora espacios extra', () => {
    assert.ok(bonusPlayerNamesMatch('Diogo costa ', 'Diogo Costa'))
  })
})
