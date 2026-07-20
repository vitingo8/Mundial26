#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns, PHASE_WEIGHT } from '../lib/gameData.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { finishedMatchesToResults } from '../lib/adminCsv.js'
import { migrateGroupResults } from '../lib/matchIdMap.js'

function buildProvisionalResults(stored, wcMatches) {
  const api = finishedMatchesToResults(wcMatches)
  return {
    group: { ...(stored?.group || {}), ...api.group },
    knockout: { ...(stored?.knockout || {}), ...api.knockout },
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').eq('id', 'u4edn0d').single()
const { data: users } = await sb.from('porra_participants').select('*').eq('group_id', 'u4edn0d')

const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const scoringOpts = { groupMatches: gm, knockoutMatches: km, apiMatches: wc.matches, fotmobStandings: wc.standings }

// Simula GroupDashboard producción: buildProvisionalResults sin mergedScoringResults extra
const provisional = buildProvisionalResults(group.results, wc.matches)
const gProd = { ...group, results: provisional }

// Simula GroupDashboard local: migrateGroupResults encima
const merged = migrateGroupResults(provisional, gm, km)
const gLocal = { ...group, results: merged }

for (const name of ['David', 'David Espuny']) {
  const p = users.find(u => u.name === name)
  const prod = calcParticipantScoreColumns(p, gProd, scoringOpts)
  const local = calcParticipantScoreColumns(p, gLocal, scoringOpts)
  console.log(JSON.stringify({
    name,
    prod: { total: prod.total, inicioGepPts: prod.inicioGepPts, inicioAdvancePts: prod.inicioAdvancePts, inicioPts: prod.inicioPts },
    local: { total: local.total, inicioGepPts: local.inicioGepPts, inicioAdvancePts: local.inicioAdvancePts, inicioPts: local.inicioPts },
    delta: Math.round((local.total - prod.total) * 10) / 10,
  }))
}

console.log('knockout keys prod migrate:', Object.keys(migrateGroupResults(provisional, gm, km).knockout).filter(k => k.includes('101')))
