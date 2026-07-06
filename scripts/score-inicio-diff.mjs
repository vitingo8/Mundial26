#!/usr/bin/env node
/** Diff inicio KO scoring for David: HEAD vs before 47b4409 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').ilike('name', '%Orleans%').single()
const { data: users } = await sb.from('porra_participants').select('*').eq('group_id', group.id)
const david = users.find(u => u.name.includes('David'))
const { getWcMatchesSafe } = await import('../lib/fotmobServerCache.js')
const { transformGroupMatches, transformKnockoutMatches } = await import('../lib/footballData.js')
const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)

async function scoreWithInicioModule(commit) {
  const tmp = join(tmpdir(), `inicio-${commit}.js`)
  writeFileSync(tmp, execSync(`git show ${commit}:lib/inicioKnockoutScoring.js`, { encoding: 'utf8' }))
  const mod = await import(pathToFileURL(tmp).href + `?v=${Date.now()}`)
  unlinkSync(tmp)
  const { calcParticipantScoreColumns } = await import('../lib/gameData.js')
  // Patch: use old inicio module by building state manually
  const { buildInicioKnockoutScoringState, calcInicioKnockoutPointsForId } = mod
  const p = { predictions: david.predictions }
  const results = group.results || {}
  const state = buildInicioKnockoutScoringState(p, {
    groupMatches: gm,
    knockoutMatches: km,
    knockoutResults: results.knockout,
    groupResults: results.group,
    apiMatches: wc.matches,
  })
  let inicioKoRaw = 0
  for (const [id, pred] of Object.entries(david.predictions?.inicioKnockout || {})) {
    if (!pred) continue
    const split = calcInicioKnockoutPointsForId(id, pred, state)
    inicioKoRaw += split.gep + split.resultado + split.advance
  }
  return Math.round(inicioKoRaw * 0.6 * 10) / 10
}

const nowInicioKo = await scoreWithInicioModule('HEAD')
const oldInicioKo = await scoreWithInicioModule('47b4409^')

console.log(JSON.stringify({
  user: david.name,
  inicioKoWeightedNow: nowInicioKo,
  inicioKoWeightedBefore47b4409: oldInicioKo,
  deltaInicioKo: +(nowInicioKo - oldInicioKo).toFixed(1),
}, null, 2))
