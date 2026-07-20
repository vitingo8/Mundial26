#!/usr/bin/env node
/** Simula la línea temporal de puntos de David en P101 */
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import { finishedMatchesToResults } from '../lib/adminCsv.js'
import { migrateGroupResults } from '../lib/matchIdMap.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').eq('id', 'u4edn0d').single()
const { data: david } = await sb.from('porra_participants').select('*').eq('group_id', 'u4edn0d').eq('name', 'David').single()

const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const opts = (api) => ({ groupMatches: gm, knockoutMatches: km, apiMatches: api ? wc.matches : [], fotmobStandings: wc.standings })

function stripP101(ko) {
  const o = { ...ko }
  for (const k of ['4653855', 'inicio-ko-101', 'knockout-ko-101']) delete o[k]
  return o
}

const stored = migrateGroupResults(group.results, gm, km)
const apiAll = finishedMatchesToResults(wc.matches)

// Escenario 1: antes del partido (sin P101)
const antes = { group: stored.group, knockout: stripP101(stored.knockout) }
const sAntes = calcParticipantScoreColumns(david, { ...group, results: antes }, opts(true))

// Escenario 2: API detecta P101 FINISHED pero grupo aún no lo guardó
const apiP101only = {
  group: stored.group,
  knockout: { ...stripP101(stored.knockout), ...Object.fromEntries(
    Object.entries(apiAll.knockout).filter(([k, v]) => k === '4653855' || v?.matchNumber === 101),
  ) },
}
const sApi = calcParticipantScoreColumns(david, { ...group, results: migrateGroupResults(apiP101only, gm, km) }, opts(true))

// Escenario 3: grupo guardó P101 (actual)
const sAhora = calcParticipantScoreColumns(david, { ...group, results: stored }, opts(true))

function fmt(c) {
  return {
    total: c.total,
    inicioGep: c.inicioGepPts,
    inicioPasa: c.inicioAdvancePts,
    koPasa: c.knockoutAdvancePts,
  }
}

console.log(JSON.stringify({
  antesPartido: fmt(sAntes),
  apiDetectaFin: fmt(sApi),
  grupoGuarda: fmt(sAhora),
  subida_api: Math.round((sApi.total - sAntes.total) * 10) / 10,
  subida_grupo: Math.round((sAhora.total - sApi.total) * 10) / 10,
  subidaTotal: Math.round((sAhora.total - sAntes.total) * 10) / 10,
  explicacion: '168,2→169,2 encaja si +1,8 G/E/P llegó antes (API) y +1,0 pasa llegó al guardar en grupo',
}, null, 2))
