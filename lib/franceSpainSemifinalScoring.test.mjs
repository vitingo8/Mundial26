import test from 'node:test'
import assert from 'node:assert/strict'
import { calcParticipantScoreColumns, calcMatchPointsSplit, PHASE_WEIGHT } from './gameData.js'
import {
  buildInicioKnockoutScoringState,
  calcInicioKnockoutPointsForId,
  calcInicioKnockoutPointsSplit,
  summarizeInicioKnockoutMatchPoints,
} from './inicioKnockoutScoring.js'
import { summarizeMatchPoints } from './matchPointsDisplay.js'
import { transformGroupMatches, transformKnockoutMatches } from './footballData.js'
import { getWcMatchesSafe } from './fotmobServerCache.js'
import { finishedMatchesToResults } from './adminCsv.js'
import { migrateGroupResults } from './matchIdMap.js'
import TEST_PREDICTIONS from './fixtures/test-scoring-predictions.json' with { type: 'json' }
import { createClient } from '@supabase/supabase-js'

async function davidPredictions(overrides = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const sb = createClient(url, key)
  const { data: group } = await sb.from('porra_groups').select('id').eq('name', 'Asuntos Internos').maybeSingle()
  if (!group?.id) return null
  const { data: u } = await sb.from('porra_participants').select('predictions').eq('name', 'David').eq('group_id', group.id).maybeSingle()
  if (!u?.predictions) return null
  return {
    ...u.predictions,
    inicioKnockout: {
      ...u.predictions.inicioKnockout,
      'inicio-ko-101': { home: 2, away: 3 },
      ...overrides.inicioKnockout,
    },
    knockout: {
      ...u.predictions.knockout,
      '4653855': { home: 2, away: 2, advances: 'away' },
      ...overrides.knockout,
    },
  }
}

test('Francia–España P101: Inicio 2-3 suma G/E/P + pasa; Eliminatorias 2-2 solo pasa', async () => {
  const wcData = await getWcMatchesSafe()
  const gm = transformGroupMatches(wcData.matches)
  const km = transformKnockoutMatches(wcData.matches)
  const apiResults = finishedMatchesToResults(wcData.matches)
  const results = migrateGroupResults(apiResults, gm, km)

  const preds = await davidPredictions()
  if (!preds) {
    assert.fail('Requiere Supabase (David en Asuntos Internos) para este test')
  }
  const participant = { predictions: preds }

  const scoringOpts = {
    groupMatches: gm,
    knockoutMatches: km,
    apiMatches: wcData.matches,
    fotmobStandings: wcData.standings,
  }

  const state = buildInicioKnockoutScoringState(participant, {
    groupMatches: gm,
    knockoutMatches: km,
    knockoutResults: results.knockout,
    groupResults: results.group,
    apiMatches: wcData.matches,
    fotmobStandings: wcData.standings,
  })

  const inicioSplit = calcInicioKnockoutPointsForId(
    'inicio-ko-101',
    participant.predictions.inicioKnockout['inicio-ko-101'],
    state,
  )
  assert.equal(inicioSplit.gep, 3)
  assert.equal(inicioSplit.advance, 1)

  const inicioSplitExplicit = calcInicioKnockoutPointsSplit(
    participant.predictions.inicioKnockout['inicio-ko-101'],
    { home: 'Francia', away: 'España', matchNumber: 101 },
    state,
    101,
  )
  assert.deepEqual(inicioSplitExplicit, inicioSplit)

  const inicioSummary = summarizeInicioKnockoutMatchPoints(
    participant.predictions.inicioKnockout['inicio-ko-101'],
    { home: 'Francia', away: 'España' },
    state,
    101,
  )
  assert.equal(inicioSummary.pts, 4)
  assert.equal(inicioSummary.rankingPts, 2.4)

  const res = results.knockout['4653855']
  const elimSummary = summarizeMatchPoints(
    participant.predictions.knockout['4653855'],
    res,
    {
      knockout: true,
      predictedTeams: { home: 'Francia', away: 'España' },
      actualTeams: { home: 'Francia', away: 'España' },
    },
  )
  assert.equal(elimSummary.pts, 1)
  assert.equal(elimSummary.rankingPts, 0.4)

  const cols = calcParticipantScoreColumns(
    participant,
    { results },
    scoringOpts,
  )
  const inicioWeighted = Math.round((inicioSplit.gep + inicioSplit.advance) * PHASE_WEIGHT.inicio * 10) / 10
  const elimSplit = calcMatchPointsSplit(
    participant.predictions.knockout['4653855'],
    res,
    {
      knockout: true,
      predictedTeams: { home: 'Francia', away: 'España' },
      actualTeams: { home: 'Francia', away: 'España' },
    },
  )
  const elimWeighted = Math.round(elimSplit.advance * PHASE_WEIGHT.knockoutReal * 10) / 10
  assert.equal(inicioWeighted + elimWeighted, 2.8)
  assert.ok(cols.inicioGepPts >= Math.round(inicioSplit.gep * PHASE_WEIGHT.inicio * 10) / 10)
  assert.ok(cols.inicioPts >= inicioWeighted)
  assert.ok(cols.knockoutPts >= elimWeighted)
})

test('P101: G/E/P desde API aunque aún no esté guardado en el grupo', async () => {
  const wcData = await getWcMatchesSafe()
  const gm = transformGroupMatches(wcData.matches)
  const km = transformKnockoutMatches(wcData.matches)
  const apiResults = finishedMatchesToResults(wcData.matches)

  const preds = await davidPredictions({ knockout: {} })
  if (!preds) {
    assert.fail('Requiere Supabase (David en Asuntos Internos) para este test')
  }
  const participant = { predictions: preds }

  const state = buildInicioKnockoutScoringState(participant, {
    groupMatches: gm,
    knockoutMatches: km,
    knockoutResults: {},
    groupResults: apiResults.group,
    apiMatches: wcData.matches,
    fotmobStandings: wcData.standings,
  })

  const split = calcInicioKnockoutPointsForId(
    'inicio-ko-101',
    participant.predictions.inicioKnockout['inicio-ko-101'],
    state,
  )
  assert.equal(split.gep, 3)
  assert.equal(split.advance, 1)
})
