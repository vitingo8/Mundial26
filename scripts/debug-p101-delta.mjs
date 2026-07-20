#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { finishedMatchesToResults } from '../lib/adminCsv.js'
import { migrateGroupResults } from '../lib/matchIdMap.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').eq('id', 'u4edn0d').single()
const { data: users } = await sb.from('porra_participants').select('*').eq('group_id', 'u4edn0d')

const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const opts = { groupMatches: gm, knockoutMatches: km, apiMatches: wc.matches, fotmobStandings: wc.standings }

function stripP101(results) {
  const ko = { ...results.knockout }
  for (const k of ['4653855', 'inicio-ko-101', 'knockout-ko-101']) delete ko[k]
  return { group: results.group, knockout: ko }
}

const full = migrateGroupResults(group.results, gm, km)
const without = stripP101(full)
const optsNoApi = { groupMatches: gm, knockoutMatches: km, apiMatches: [], fotmobStandings: null }

for (const name of ['David', 'David Espuny']) {
  const p = users.find(u => u.name === name)
  const before = calcParticipantScoreColumns(p, { ...group, results: without }, optsNoApi)
  const after = calcParticipantScoreColumns(p, { ...group, results: full }, optsNoApi)
  const d = (k) => Math.round((after[k] - before[k]) * 10) / 10
  console.log(JSON.stringify({
    name,
    deltaTotal: d('total'),
    deltaInicioGep: d('inicioGepPts'),
    deltaInicioPasa: d('inicioAdvancePts'),
    deltaKoPasa: d('knockoutAdvancePts'),
    deltaPasaColumns: Math.round((d('inicioAdvancePts') + d('knockoutAdvancePts')) * 10) / 10,
  }))
}
