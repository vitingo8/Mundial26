#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import {
  calcInicioKnockoutPointsForId,
  buildInicioKnockoutScoringState,
  summarizeInicioKnockoutMatchPoints,
} from '../lib/inicioKnockoutScoring.js'
import { calcMatchPointsSplit, PHASE_WEIGHT } from '../lib/gameData.js'
import { finishedMatchesToResults } from '../lib/adminCsv.js'
import { migrateGroupResults } from '../lib/matchIdMap.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { buildInicioKnockoutSchedule } from '../lib/knockoutBridge.js'
import { summarizeMatchPoints } from '../lib/matchPointsDisplay.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').ilike('name', '%Orleans%').single()
const { data: salaet } = await sb.from('porra_participants').select('*').eq('group_id', group.id).eq('name', 'Salaet').single()

const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const p78 = km.find(m => m.matchNumber === 78)
const api = finishedMatchesToResults(wc.matches)
const results = migrateGroupResults(
  { group: { ...group.results?.group, ...api.group }, knockout: { ...group.results?.knockout, ...api.knockout } },
  gm,
  km,
)

const preds = salaet.predictions
const { schedule } = buildInicioKnockoutSchedule(gm, preds.group || {}, preds.inicioKnockout || {})
const slot78 = schedule.find(m => m.matchNumber === 78)

const state = buildInicioKnockoutScoringState(
  { predictions: preds },
  { groupMatches: gm, knockoutMatches: km, knockoutResults: results.knockout, groupResults: results.group, apiMatches: wc.matches, fotmobStandings: wc.standings },
)

const inicioPred = preds.inicioKnockout?.['inicio-ko-78']
const inicioSplit = calcInicioKnockoutPointsForId('inicio-ko-78', inicioPred, state)
const inicioSummary = summarizeInicioKnockoutMatchPoints(inicioPred, { home: slot78?.home, away: slot78?.away }, state, 78)

const koPred = preds.knockout?.[String(p78?.id)] ?? preds.knockout?.['4653832']
const koRes = results.knockout?.[String(p78?.id)] ?? results.knockout?.['inicio-ko-78']
let elimSplit = null
let elimSummary = null
if (koPred && koRes) {
  elimSplit = calcMatchPointsSplit(koPred, koRes, {
    knockout: true,
    predictedTeams: { home: 'Costa de Marfil', away: 'Noruega' },
    actualTeams: { home: 'Costa de Marfil', away: 'Noruega' },
  })
  elimSummary = summarizeMatchPoints(koPred, koRes, {
    knockout: true,
    predictedTeams: { home: 'Costa de Marfil', away: 'Noruega' },
    actualTeams: { home: 'Costa de Marfil', away: 'Noruega' },
  })
}

const w = (raw, phase) => Math.round(raw * phase * 10) / 10
const inicioWeighted = {
  gep: w(inicioSplit.gep, PHASE_WEIGHT.inicio),
  resultado: w(inicioSplit.resultado, PHASE_WEIGHT.inicio),
  advance: w(inicioSplit.advance, PHASE_WEIGHT.inicio),
}
const elimWeighted = elimSplit ? {
  gep: w(elimSplit.gep, PHASE_WEIGHT.knockoutReal),
  resultado: w(elimSplit.resultado, PHASE_WEIGHT.knockoutReal),
  advance: w(elimSplit.advance, PHASE_WEIGHT.knockoutReal),
} : null

console.log(JSON.stringify({
  p78Catalog: p78 ? { id: p78.id, home: p78.home, away: p78.away } : null,
  inicioSlot78: slot78 ? { home: slot78.home, away: slot78.away } : null,
  inicioPred,
  koPred,
  koRes,
  inicioSplit,
  inicioWeighted,
  inicioSummary,
  elimSplit,
  elimWeighted,
  elimSummary,
  totalP78: Math.round((inicioWeighted.gep + inicioWeighted.resultado + inicioWeighted.advance + (elimWeighted ? elimWeighted.gep + elimWeighted.resultado + elimWeighted.advance : 0)) * 10) / 10,
}, null, 2))
