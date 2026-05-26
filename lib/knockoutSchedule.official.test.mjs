/**
 * Calendario eliminatorio oficial FIFA (partidos 73–104).
 * Referencia: cuadro comunicado por el usuario / FIFA 2026.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'
import { KNOCKOUT_BRACKET_TREE } from './knockoutBracketTree.js'
import { formatFifaSlotCode } from './formatFifaSlot.js'

const R32_OFFICIAL = [
  [73, '2A', '2B'],
  [74, '1E', '3A/B/C/D/F'],
  [75, '1F', '2C'],
  [76, '1C', '2F'],
  [77, '1I', '3C/D/F/G/H'],
  [78, '2E', '2I'],
  [79, '1A', '3C/E/F/H/I'],
  [80, '1L', '3E/H/I/J/K'],
  [81, '1D', '3B/E/F/I/J'],
  [82, '1G', '3A/E/H/I/J'],
  [83, '2K', '2L'],
  [84, '1H', '2J'],
  [85, '1B', '3E/F/G/I/J'],
  [86, '1J', '2H'],
  [87, '1K', '3D/E/I/J/L'],
  [88, '2D', '2G'],
]

/** Gnn en documentación = Wnn en código */
const BRACKET_OFFICIAL = [
  [89, 'G74', 'G77'],
  [90, 'G73', 'G75'],
  [91, 'G76', 'G78'],
  [92, 'G79', 'G80'],
  [93, 'G83', 'G84'],
  [94, 'G81', 'G82'],
  [95, 'G86', 'G88'],
  [96, 'G85', 'G87'],
  [97, 'G89', 'G90'],
  [98, 'G93', 'G94'],
  [99, 'G91', 'G92'],
  [100, 'G95', 'G96'],
  [101, 'G97', 'G98'],
  [102, 'G99', 'G100'],
  [103, 'P101', 'P102'],
  [104, 'G101', 'G102'],
]

function gToW(label) {
  return label.replace(/^G(\d+)$/, 'W$1').replace(/^P(\d+)$/, 'L$1')
}

describe('knockout schedule vs FIFA official', () => {
  it('dieciseisavos 73–88', () => {
    assert.equal(roundOf32Map.length, 16)
    for (const [n, home, away] of R32_OFFICIAL) {
      const slot = roundOf32Map.find(s => s.match === n)
      assert.ok(slot, `missing match ${n}`)
      assert.equal(slot.home, home, `match ${n} home`)
      assert.equal(slot.away, away, `match ${n} away`)
    }
  })

  it('octavos a final 89–104 (W/L internos = G/P en UI)', () => {
    assert.equal(KNOCKOUT_BRACKET_TREE.length, 16)
    for (const [n, homeG, awayG] of BRACKET_OFFICIAL) {
      const slot = KNOCKOUT_BRACKET_TREE.find(s => s.match === n)
      assert.ok(slot, `missing match ${n}`)
      assert.equal(formatFifaSlotCode(slot.home), homeG, `match ${n} home`)
      assert.equal(formatFifaSlotCode(slot.away), awayG, `match ${n} away`)
      assert.equal(slot.home, gToW(homeG), `match ${n} home code`)
      assert.equal(slot.away, gToW(awayG), `match ${n} away code`)
    }
  })
})
