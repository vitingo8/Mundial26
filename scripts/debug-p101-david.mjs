#!/usr/bin/env node
/** Debug P101 scoring for David — node --env-file=.env.local scripts/debug-p101-david.mjs */
import { createClient } from '@supabase/supabase-js'
import { calcInicioKnockoutPointsForId, buildInicioKnockoutScoringState } from '../lib/inicioKnockoutScoring.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { finishedMatchesToResults } from '../lib/adminCsv.js'
import { migrateGroupResults } from '../lib/matchIdMap.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').eq('id', 'u4edn0d').single()
const { data: david } = await sb.from('porra_participants').select('*').eq('group_id', 'u4edn0d').eq('name', 'David').single()
const { data: espuny } = await sb.from('porra_participants').select('*').eq('group_id', 'u4edn0d').eq('name', 'David Espuny').single()

const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const apiResults = finishedMatchesToResults(wc.matches)
const groupResults = migrateGroupResults(group.results, gm, km)
const mergedApi = migrateGroupResults(apiResults, gm, km)

function debug(participant, label, knockoutResults) {
  const p = { predictions: participant.predictions }
  const state = buildInicioKnockoutScoringState(p, {
    groupMatches: gm,
    knockoutMatches: km,
    knockoutResults,
    groupResults: groupResults.group,
    apiMatches: wc.matches,
    fotmobStandings: wc.standings,
  })
  const pred = participant.predictions.inicioKnockout['inicio-ko-101']
  const teams = state.inicioPredictedById['inicio-ko-101']
  const split = calcInicioKnockoutPointsForId('inicio-ko-101', pred, state)
  console.log(JSON.stringify({ label, pred, teams, split, weighted: Math.round((split.gep + split.advance) * 0.6 * 10) / 10 }, null, 2))
}

console.log('--- Con resultados del grupo (Supabase) ---')
debug(david, 'David', groupResults.knockout)
debug(espuny, 'David Espuny', groupResults.knockout)
console.log('--- Solo API (sin resultados grupo) ---')
debug(david, 'David', mergedApi.knockout)
