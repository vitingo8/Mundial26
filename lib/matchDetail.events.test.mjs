import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMatchEventsTabItems,
  mergeFotmobRawEvents,
} from './matchDetail.js'

describe('matchDetail penalty shootout events', () => {
  it('merges penaltyShootoutEvents before PenaltyShootout summary', () => {
    const merged = mergeFotmobRawEvents({
      events: [
        { type: 'Half', halfStrShort: 'FT', homeScore: 1, awayScore: 1 },
        { type: 'PenaltyShootout', homeScore: 4, awayScore: 5 },
      ],
      penaltyShootoutEvents: [
        { type: 'Goal', isPenaltyShootoutEvent: true, isHome: true, nameStr: 'Kimmich', penShootoutScore: [1, 0] },
        { type: 'MissedPenalty', isPenaltyShootoutEvent: true, isHome: false, nameStr: 'Balbuena', penShootoutScore: [3, 3] },
      ],
    })
    assert.equal(merged.length, 4)
    assert.equal(merged[1].nameStr, 'Kimmich')
    assert.equal(merged[3].type, 'PenaltyShootout')
  })

  it('builds pen shootout rows in Eventos timeline', () => {
    const items = buildMatchEventsTabItems({
      homeTeam: { name: 'Alemania' },
      awayTeam: { name: 'Paraguay' },
      rawEvents: [
        { type: 'Half', halfStrShort: 'FT', homeScore: 1, awayScore: 1, time: 90 },
        { type: 'Half', halfStrShort: 'AET', homeScore: 1, awayScore: 1, time: 120 },
        { type: 'Goal', isPenaltyShootoutEvent: true, isHome: true, nameStr: 'Kimmich', playerId: 1, penShootoutScore: [1, 0] },
        { type: 'MissedPenalty', isPenaltyShootoutEvent: true, isHome: false, nameStr: 'Balbuena', playerId: 2, penShootoutScore: [3, 3] },
        { type: 'PenaltyShootout', homeScore: 4, awayScore: 5 },
      ],
    }, 'Alemania', 'Paraguay')

    const pens = items.filter(i => i.kind === 'penShootout')
    assert.equal(pens.length, 2)
    assert.equal(pens[0].playerName, 'Kimmich')
    assert.equal(pens[0].outcome, 'scored')
    assert.deepEqual(pens[0].penScore, { home: 1, away: 0 })
    assert.equal(pens[1].outcome, 'missed')
    assert.ok(items.some(i => i.kind === 'penShootoutHeader' && i.label.includes('4 - 5')))
    assert.ok(items.some(i => i.kind === 'half' && i.label.includes('Fin 1 - 1')))
  })
})
