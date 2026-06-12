import test from 'node:test'
import assert from 'node:assert/strict'
import {
  annotateBenchPlayers,
  enrichPlayerMatchEvents,
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

test('annotateBenchPlayers marca expulsados en banquillo', () => {
  const bench = [{ id: 9, name: 'Suplente Rojo', shirtNumber: 9 }]
  const match = {
    homeTeam: {
      name: 'México',
      bench,
    },
    awayTeam: { name: 'Visitante', bench: [] },
    bookings: [{
      card: 'RED',
      team: { name: 'México' },
      player: { id: 9, name: 'Suplente Rojo' },
    }],
  }

  const annotated = annotateBenchPlayers(bench, [], 'México', match)
  assert.equal(annotated[0].sentOff, true)
})

test('enrichPlayerMatchEvents marca goles y asistencias en suplentes', () => {
  const player = { id: 16, name: 'Julián Quiñones', events: [] }
  const match = {
    goals: [{
      team: { name: 'México' },
      scorer: { id: 16, name: 'Julián Quiñones' },
      assist: { id: 6, name: 'Érik Lira' },
    }],
  }

  const scorer = enrichPlayerMatchEvents(player, match, 'México')
  assert.ok(scorer.events.includes('goal'))

  const assister = enrichPlayerMatchEvents(
    { id: 6, name: 'Érik Lira', events: [] },
    match,
    'México',
  )
  assert.ok(assister.events.includes('assist'))
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
