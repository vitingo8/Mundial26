import test from 'node:test'
import assert from 'node:assert/strict'
import {
  annotateBenchPlayers,
  getUnifiedSubstitutions,
  parseEventMinuteLabel,
} from './matchDetail.js'

test('parseEventMinuteLabel extrae descuento', () => {
  assert.deepEqual(parseEventMinuteLabel("67+2'"), { minute: 67, injuryTime: 2 })
  assert.deepEqual(parseEventMinuteLabel(45), { minute: 45, injuryTime: null })
})

test('annotateBenchPlayers marca suplentes que entraron', () => {
  const bench = [
    { id: 1, name: 'Suplente A', shirtNumber: 12 },
    { id: 2, name: 'Suplente B', shirtNumber: 20 },
  ]
  const subs = [{
    minute: 70,
    injuryTime: null,
    teamName: 'México',
    playerIn: { id: 2, name: 'Suplente B' },
    playerOut: { id: 99, name: 'Titular X', shirtNumber: 9 },
  }]

  const annotated = annotateBenchPlayers(bench, subs, 'México')
  assert.equal(annotated[0].subOn?.minute, 70)
  assert.equal(annotated[0].name, 'Suplente B')
  assert.equal(annotated[0].subOn.replaced.name, 'Titular X')
  assert.equal(annotated[1].subOn, null)
})

test('getUnifiedSubstitutions combina eventos y feed LTC', () => {
  const match = {
    homeTeam: {
      bench: [{ id: 10, name: 'Entra', shirtNumber: 7 }],
    },
    awayTeam: { bench: [] },
    substitutions: [{
      minute: 60,
      team: { name: 'Local' },
      playerIn: { id: 10, name: 'Entra' },
      playerOut: { name: 'Sale' },
    }],
    liveCommentary: [{
      isSubstitution: true,
      isHome: true,
      minute: "60'",
      substitution: {
        playerIn: { id: 10, name: 'Entra' },
        playerOut: { id: 5, name: 'Sale' },
      },
    }],
  }

  const subs = getUnifiedSubstitutions(match, 'Local', 'Visitante')
  assert.equal(subs.length, 1)
  assert.equal(subs[0].playerIn.id, 10)
})
