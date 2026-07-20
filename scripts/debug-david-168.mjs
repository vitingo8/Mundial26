#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import { migrateGroupResults } from '../lib/matchIdMap.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'

import { finishedMatchesToResults } from '../lib/adminCsv.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').eq('id', 'u4edn0d').single()
const { data: david } = await sb.from('porra_participants').select('*').eq('group_id', 'u4edn0d').eq('name', 'David').single()

const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)

function buildProvisionalResults(stored, wcMatches, { excludeP101 = false } = {}) {
  const api = finishedMatchesToResults(wcMatches)
  const live = ['IN_PLAY', 'PAUSED', 'LIVE']
  const overlay = {}
  const isP101 = (m) => m.matchNumber === 101 || String(m.id) === '4653855'
  for (const m of wcMatches || []) {
    if (excludeP101 && isP101(m)) continue
    if (m.stage && m.stage !== 'GROUP_STAGE') continue
    if (!live.includes(m.status)) continue
    const s = m.score?.fullTime ?? m.score
    if (s?.home != null) overlay[String(m.id)] = { home: s.home, away: s.away }
  }
  const filterKo = (ko) => {
    if (!excludeP101) return ko
    return Object.fromEntries(Object.entries(ko).filter(([k, v]) =>
      k !== '4653855' && k !== 'inicio-ko-101' && k !== 'knockout-ko-101' && v?.matchNumber !== 101,
    ))
  }
  return {
    group: { ...(stored?.group || {}), ...api.group, ...overlay },
    knockout: filterKo({ ...(stored?.knockout || {}), ...api.knockout }),
  }
}

const fullProv = migrateGroupResults(buildProvisionalResults(group.results, wc.matches), gm, km)
const antesProv = migrateGroupResults(buildProvisionalResults(group.results, wc.matches, { excludeP101: true }), gm, km)

const opts = { groupMatches: gm, knockoutMatches: km, apiMatches: wc.matches, fotmobStandings: wc.standings }
const optsSinP101 = {
  ...opts,
  apiMatches: wc.matches.filter(m => m.matchNumber !== 101 && String(m.id) !== '4653855'),
}

const antes = calcParticipantScoreColumns(david, { ...group, results: antesProv }, optsSinP101)
const ahora = calcParticipantScoreColumns(david, { ...group, results: fullProv }, opts)

console.log(JSON.stringify({
  antesPartido_real: { total: antes.total, inicioGep: antes.inicioGepPts, inicioPasa: antes.inicioAdvancePts, koPasa: antes.knockoutAdvancePts },
  ahora: { total: ahora.total, inicioGep: ahora.inicioGepPts, inicioPasa: ahora.inicioAdvancePts, koPasa: ahora.knockoutAdvancePts },
  subidaEsperada: Math.round((ahora.total - antes.total) * 10) / 10,
  usuarioDice: { antes: 168.2, ahora: 169.2, subidaVista: 1.0 },
  diferencia: {
    antesUsuarioVsReal: Math.round((168.2 - antes.total) * 10) / 10,
    ahoraUsuarioVsReal: Math.round((169.2 - ahora.total) * 10) / 10,
    puntosQueFaltarianSi168_2EraReal: Math.round((ahora.total - 168.2) * 10) / 10,
  },
}, null, 2))
