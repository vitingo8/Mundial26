#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns, calcMatchPointsSplit, PHASE_WEIGHT } from '../lib/gameData.js'
import { listEliminatoriasScoringMatches, buildKnockoutScoringContext, resolveKnockoutResult, resolveKnockoutTeamsForScoring } from '../lib/knockoutMatchScoring.js'
import { lookupEliminatoriasKoPred } from '../lib/knockoutBridge.js'
import { enrichKnockoutResultWithAdvances } from '../lib/knockoutRegulationScore.js'
import { calcInicioKnockoutPointsForId, buildInicioKnockoutScoringState } from '../lib/inicioKnockoutScoring.js'
import { summarizeMatchPoints } from '../lib/matchPointsDisplay.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { indexApiMatches } from '../lib/apiMatchScores.js'
import { isInicioKoId } from '../lib/matchPointsDisplay.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').ilike('name', '%Orleans%').single()
const { data: users } = await sb.from('porra_participants').select('*').eq('group_id', group.id)
const otero = users.find(u => /otero/i.test(u.name))
if (!otero) throw new Error('Otero not found')

const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const kmBroken = km.map(m =>
  m.id === '4653842' ? { ...m, matchNumber: undefined, fifaMatchLabel: null } : m,
)
const apiById = indexApiMatches(wc.matches)

function fullBreakdown(kmUse, label) {
  const p = { predictions: otero.predictions }
  const cols = calcParticipantScoreColumns(p, group, { groupMatches: gm, knockoutMatches: kmUse, apiMatches: wc.matches })
  const results = group.results || {}
  const koCtx = buildKnockoutScoringContext(p, { groupMatches: gm, knockoutMatches: kmUse, koPreds: p.predictions?.knockout, apiMatches: wc.matches })
  const inicioState = buildInicioKnockoutScoringState(p, {
    groupMatches: gm, knockoutMatches: kmUse, knockoutResults: results.knockout, groupResults: results.group, apiMatches: wc.matches,
  })
  const items = []

  for (const m of gm) {
    const pred = p.predictions?.group?.[m.id]
    const res = results.group?.[m.id]
    if (!pred || res?.home == null) continue
    const split = calcMatchPointsSplit(pred, res)
    const raw = split.gep + split.resultado + split.advance
    if (raw <= 0) continue
    items.push({ phase: 'grupos', label: `${m.home} vs ${m.away}`, raw, weighted: Math.round(raw * 0.6 * 10) / 10, detail: summarizeMatchPoints(pred, res)?.detail })
  }
  for (const [id, pred] of Object.entries(p.predictions?.inicioKnockout || {})) {
    if (!isInicioKoId(id) || !pred) continue
    const split = calcInicioKnockoutPointsForId(id, pred, inicioState)
    const raw = split.gep + split.resultado + split.advance
    if (raw <= 0) continue
    items.push({ phase: 'inicio-ko', label: id, raw, weighted: Math.round(raw * 0.6 * 10) / 10 })
  }
  for (const m of listEliminatoriasScoringMatches(kmUse, p.predictions?.knockout, { groupMatches: gm, apiMatches: wc.matches })) {
    const pred = lookupEliminatoriasKoPred(p.predictions?.knockout, m)
    const rawRes = resolveKnockoutResult(m.id, results.knockout, koCtx)
    if (!pred || rawRes?.home == null) continue
    const res = enrichKnockoutResultWithAdvances(rawRes, apiById[String(m.id)])
    let { predictedTeams, actualTeams } = resolveKnockoutTeamsForScoring(m.id, res, koCtx)
    if (actualTeams?.home) predictedTeams = actualTeams
    const split = calcMatchPointsSplit(pred, res, { knockout: true, predictedTeams, actualTeams })
    const raw = split.gep + split.resultado + split.advance
    if (raw <= 0) continue
    items.push({
      phase: 'eliminatorias',
      P: m.matchNumber,
      label: `${m.home} vs ${m.away}`,
      id: m.id,
      raw,
      weighted: Math.round(raw * PHASE_WEIGHT.knockoutReal * 10) / 10,
      detail: summarizeMatchPoints(pred, res, { knockout: true, predictedTeams, actualTeams })?.detail,
    })
  }
  return { label, total: cols.total, cols, items }
}

const now = fullBreakdown(km, 'ahora')
const before = fullBreakdown(kmBroken, 'sin P89 Paraguay-Francia')

const beforeIds = new Set(before.items.map(i => `${i.phase}|${i.id || i.label}`))
const gained = now.items.filter(i => {
  const key = `${i.phase}|${i.id || i.label}`
  const prev = before.items.find(b => `${b.phase}|${b.id || b.label}` === key)
  return !prev || prev.weighted !== i.weighted
}).map(i => {
  const prev = before.items.find(b => `${b.phase}|${b.id || b.label}` === `${i.phase}|${i.id || i.label}`)
  return { ...i, weightedBefore: prev?.weighted ?? 0, delta: +(i.weighted - (prev?.weighted ?? 0)).toFixed(1) }
})

console.log(JSON.stringify({
  user: otero.name,
  totalAhora: now.total,
  totalSinFixP89: before.total,
  deltaPorFixP89: +(now.total - before.total).toFixed(1),
  columnas: {
    inicio: now.cols.inicioPts,
    eliminatorias: now.cols.knockoutPts,
    bonus: now.cols.bonusPts,
  },
  puntosNuevos_o_cambiados: gained,
  octavos: now.items.filter(i => i.phase === 'eliminatorias' && (i.P === 89 || i.P === 90)),
}, null, 2))
