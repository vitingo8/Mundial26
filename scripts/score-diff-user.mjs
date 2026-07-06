#!/usr/bin/env node
/**
 * Compara puntuación real de un participante: catálogo actual vs bug P89 duplicado.
 * node --env-file=.env.local scripts/score-diff-user.mjs [grupo] [usuario]
 */
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import { listEliminatoriasScoringMatches } from '../lib/knockoutMatchScoring.js'
import { lookupEliminatoriasKoPred } from '../lib/knockoutBridge.js'
import { summarizeMatchPoints } from '../lib/matchPointsDisplay.js'
import { enrichKnockoutResultWithAdvances } from '../lib/knockoutRegulationScore.js'
import { resolveKnockoutResult, resolveKnockoutTeamsForScoring, buildKnockoutScoringContext } from '../lib/knockoutMatchScoring.js'
import { calcMatchPointsSplit } from '../lib/gameData.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { indexApiMatches } from '../lib/apiMatchScores.js'
import { PHASE_WEIGHT } from '../lib/gameData.js'

const GROUP_NAME = process.argv[2] || 'Orleans League'
const USER_NAME = process.argv[3] || 'David Espuny'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const { data: group, error: gErr } = await sb
  .from('porra_groups')
  .select('*')
  .ilike('name', `%${GROUP_NAME}%`)
  .single()
if (gErr || !group) throw new Error(gErr?.message || 'group not found')

const { data: users } = await sb
  .from('porra_participants')
  .select('id,name,predictions')
  .eq('group_id', group.id)

const participant = (users || []).find(p =>
  p.name.toLowerCase().includes('david') && p.name.toLowerCase().includes('espuny'),
) || users?.find(p => p.name.toLowerCase().includes(USER_NAME.toLowerCase()))
if (!participant) throw new Error('user not found')

const wcData = await getWcMatchesSafe()
const wcMatches = wcData?.matches || []
const groupMatches = transformGroupMatches(wcMatches)
const knockoutMatches = transformKnockoutMatches(wcMatches)
const apiById = indexApiMatches(wcMatches)

function scoreWith(km, label) {
  const p = { predictions: participant.predictions }
  const cols = calcParticipantScoreColumns(p, group, {
    groupMatches,
    knockoutMatches: km,
    apiMatches: wcMatches,
  })
  return { label, ...cols }
}

const current = scoreWith(knockoutMatches, 'actual (fix P89/P90)')

// Bug: Paraguay-Francia pierde número FIFA (quedaba duplicado con Canadá-Marruecos en P89)
const kmOrphanPy = knockoutMatches.map(m =>
  m.id === '4653842' ? { ...m, matchNumber: undefined, fifaMatchLabel: null, knockoutMatchupLabel: null } : m,
)
const orphan = scoreWith(kmOrphanPy, 'sin P89 Paraguay-Francia')

// Bug: Canadá-Marruecos mal asignado a P89 en lugar de P90
const kmWrong90 = knockoutMatches.map(m => {
  if (m.id === '4653843') return { ...m, matchNumber: 89, fifaMatchLabel: 'Partido 89' }
  if (m.id === '4653842') return { ...m, matchNumber: undefined, fifaMatchLabel: null }
  return m
})
const wrong = scoreWith(kmWrong90, 'solo Canadá-Marruecos como P89')

function elimMatchBreakdown(km) {
  const p = { predictions: participant.predictions }
  const koCtx = buildKnockoutScoringContext(p, {
    groupMatches,
    knockoutMatches: km,
    koPreds: p.predictions?.knockout,
    apiMatches: wcMatches,
  })
  const results = group.results || {}
  const schedule = listEliminatoriasScoringMatches(km, p.predictions?.knockout, {
    groupMatches,
    apiMatches: wcMatches,
  })
  const rows = []
  for (const m of schedule) {
    const pred = lookupEliminatoriasKoPred(p.predictions?.knockout, m)
    const rawRes = resolveKnockoutResult(m.id, results.knockout, koCtx)
    if (!pred || rawRes?.home == null || rawRes?.away == null) continue
    const res = enrichKnockoutResultWithAdvances(rawRes, apiById[String(m.id)])
    let { predictedTeams, actualTeams } = resolveKnockoutTeamsForScoring(m.id, res, koCtx)
    if (actualTeams?.home && actualTeams?.away) predictedTeams = actualTeams
    const split = calcMatchPointsSplit(pred, res, { knockout: true, predictedTeams, actualTeams })
    const raw = split.gep + split.resultado + split.advance
    if (raw <= 0) continue
    const weighted = Math.round(raw * PHASE_WEIGHT.knockoutReal * 10) / 10
    const sum = summarizeMatchPoints(pred, res, { knockout: true, predictedTeams, actualTeams })
    rows.push({
      P: m.matchNumber,
      match: `${m.home} vs ${m.away}`,
      id: m.id,
      raw,
      weighted,
      detail: sum?.detail,
    })
  }
  return rows
}

const koNow = elimMatchBreakdown(knockoutMatches)
const koBefore = elimMatchBreakdown(kmOrphanPy)

const onlyNow = koNow.filter(r => !koBefore.some(b => b.id === r.id && b.raw === r.raw))
const onlyBefore = koBefore.filter(b => !koNow.some(r => r.id === b.id && r.raw === b.raw))

console.log(JSON.stringify({
  group: group.name,
  user: participant.name,
  totals: {
    actual: { total: current.total, knockoutPts: current.knockoutPts, inicioPts: current.inicioPts, bonusPts: current.bonusPts },
    sinParaguayP89: { total: orphan.total, knockoutPts: orphan.knockoutPts },
    deltaTotal: +(current.total - orphan.total).toFixed(1),
    deltaKnockout: +(current.knockoutPts - orphan.knockoutPts).toFixed(1),
  },
  eliminatoriasQuePuntuanAhora: koNow,
  eliminatoriasQuePuntuabanAntes: koBefore,
  puntosNuevosPorFix: onlyNow,
  puntosPerdidosPorFix: onlyBefore,
}, null, 2))
