#!/usr/bin/env node
/**
 * Exporta Excel/CSV de puntuación partido a partido para un participante.
 * node --env-file=.env.local scripts/export-participant-excel.mjs [usuario] [grupo] [salida]
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calcMatchPointsSplit,
  calcParticipantScoreColumns,
  PHASE_WEIGHT,
  SCORING,
} from '../lib/gameData.js'
import { enrichApiMatches } from '../lib/fifaMatchNumbers.js'
import { buildCatalogApiMatches } from '../lib/catalogApiMatches.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { indexApiMatches } from '../lib/apiMatchScores.js'
import { migrateParticipantPredictions, migrateGroupResults } from '../lib/matchIdMap.js'
import {
  inicioKoMatchId,
  lookupEliminatoriasKoPred,
  lookupInicioKoPred,
  normalizeInicioKoPreds,
  buildInicioKnockoutSchedule,
} from '../lib/knockoutBridge.js'
import {
  buildKnockoutScoringContext,
  listEliminatoriasScoringMatches,
  resolveKnockoutResult,
  resolveKnockoutTeamsForScoring,
} from '../lib/knockoutMatchScoring.js'
import {
  buildInicioKnockoutScoringState,
  calcInicioKnockoutPointsForId,
} from '../lib/inicioKnockoutScoring.js'
import { enrichKnockoutResultWithAdvances } from '../lib/knockoutRegulationScore.js'
import { resolveKnockoutAdvanceSide, resolveKnockoutWinnerTeam } from '../lib/knockoutAdvances.js'
import { displayTeamName } from '../lib/teamNamesEs.js'
import { calcGroupQualificationPoints } from '../lib/groupQualificationScoring.js'

const USER_QUERY = process.argv[2] || 'Salaet'
const GROUP_QUERY = process.argv[3] || 'Orleans'
const OUT_ARG = process.argv[4]

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function round1(n) {
  return Math.round(n * 10) / 10
}

function formatScore(pred) {
  if (!pred || pred.home == null || pred.away == null) return ''
  return `${pred.home}-${pred.away}`
}

function formatAdvance(pred, teams) {
  if (!pred || !teams) return ''
  const side = resolveKnockoutAdvanceSide(pred)
  if (!side) return ''
  const w = resolveKnockoutWinnerTeam(pred, teams)
  return w?.name || (side === 'home' ? teams.home : teams.away) || ''
}

function formatPredWithAdvance(pred, teams) {
  const score = formatScore(pred)
  if (!score) return ''
  const adv = formatAdvance(pred, teams)
  if (!adv || !resolveKnockoutAdvanceSide(pred)) return score
  if (Number(pred.home) !== Number(pred.away)) return score
  return `${score} (${adv})`
}

function weightedPts(raw, phase) {
  const w = phase === 'elim' ? PHASE_WEIGHT.knockoutReal : PHASE_WEIGHT.inicio
  return round1(raw * w)
}

function formatCruce(teams) {
  if (!teams?.home || !teams?.away) return ''
  return `${teams.home} vs ${teams.away}`
}

function buildMatchLabel(m) {
  const n = m.matchNumber
  const home = m.home || m.homeTeam?.shortName || m.homeTeam?.name || '?'
  const away = m.away || m.awayTeam?.shortName || m.awayTeam?.name || '?'
  const prefix = n != null ? `P${n}` : ''
  const grp = m.group ? ` [${m.group}]` : ''
  return `${prefix}${grp} ${home} vs ${away}`.trim()
}

function resolveTeamsForMatch(m, gmByNum, kmByNum) {
  if (m.matchNumber <= 72) {
    const gm = gmByNum.get(m.matchNumber)
    return gm ? { home: gm.home, away: gm.away } : null
  }
  const km = kmByNum.get(m.matchNumber)
  if (km?.home && km?.away) return { home: km.home, away: km.away }
  return {
    home: displayTeamName(m.homeTeam?.shortName || m.homeTeam?.name || m.home),
    away: displayTeamName(m.awayTeam?.shortName || m.awayTeam?.name || m.away),
  }
}

function getRealResult(matchNumber, results, apiById, kmByNum, gmByNum) {
  if (matchNumber <= 72) {
    const gmRow = gmByNum.get(matchNumber)
    if (gmRow?.id && results.group?.[gmRow.id]?.home != null) {
      return results.group[gmRow.id]
    }
    for (const res of Object.values(results.group || {})) {
      if (res?.matchNumber === matchNumber && res?.home != null) return res
    }
    return results.group?.[`catalog-${matchNumber}`] || null
  }
  const km = kmByNum.get(matchNumber)
  const ids = [
    km?.id,
    inicioKoMatchId(matchNumber),
    `knockout-ko-${matchNumber}`,
    `catalog-${matchNumber}`,
  ].filter(Boolean)
  for (const id of ids) {
    const raw = results.knockout?.[String(id)]
    if (raw?.home != null) {
      const api = apiById[String(km?.id)] || apiById[String(id)]
      return enrichKnockoutResultWithAdvances(raw, api)
    }
  }
  for (const [id, res] of Object.entries(results.knockout || {})) {
    if (res?.matchNumber === matchNumber && res?.home != null) {
      const api = apiById[String(km?.id)] || apiById[String(id)]
      return enrichKnockoutResultWithAdvances(res, api)
    }
  }
  return null
}

const { data: group, error: gErr } = await sb
  .from('porra_groups')
  .select('*')
  .ilike('name', `%${GROUP_QUERY}%`)
  .single()
if (gErr || !group) throw new Error(gErr?.message || `Grupo no encontrado: ${GROUP_QUERY}`)

const { data: users } = await sb
  .from('porra_participants')
  .select('*')
  .eq('group_id', group.id)

const participant = (users || []).find(p =>
  p.name.toLowerCase().includes(USER_QUERY.toLowerCase()),
)
if (!participant) throw new Error(`Participante no encontrado: ${USER_QUERY}`)

const wc = await getWcMatchesSafe()
const apiMatches = wc?.matches?.length ? wc.matches : enrichApiMatches(buildCatalogApiMatches())
const fotmobStandings = wc?.standings ?? null
const gm = transformGroupMatches(apiMatches)
const km = transformKnockoutMatches(apiMatches)
const apiById = indexApiMatches(apiMatches)
const scoringOpts = { groupMatches: gm, knockoutMatches: km, apiMatches, fotmobStandings }

const catalog = enrichApiMatches(buildCatalogApiMatches())
  .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0))

const gmByNum = new Map(gm.filter(m => m.matchNumber != null).map(m => [m.matchNumber, m]))
const kmByNum = new Map(km.filter(m => m.matchNumber != null).map(m => [m.matchNumber, m]))

const preds = migrateParticipantPredictions(participant.predictions || {}, gm, km)
const inicioKoPreds = normalizeInicioKoPreds(preds.inicioKnockout || {})
const results = migrateGroupResults(group.results || {}, gm, km)

const inicioState = buildInicioKnockoutScoringState(
  { predictions: { ...preds, inicioKnockout: inicioKoPreds } },
  {
    groupMatches: gm,
    knockoutMatches: km,
    knockoutResults: results.knockout,
    groupResults: results.group,
    fotmobStandings,
    apiMatches,
  },
)

const koCtx = buildKnockoutScoringContext(
  { predictions: preds },
  { groupMatches: gm, knockoutMatches: km, koPreds: preds.knockout, apiMatches, fotmobStandings },
)

const elimScheduleByNum = new Map(
  listEliminatoriasScoringMatches(km, preds.knockout, { groupMatches: gm, apiMatches, fotmobStandings })
    .filter(m => m.matchNumber != null)
    .map(m => [m.matchNumber, m]),
)

const { schedule: inicioKoSchedule } = buildInicioKnockoutSchedule(gm, preds.group || {}, inicioKoPreds)
const inicioCruceByNum = new Map(
  inicioKoSchedule.filter(m => m.matchNumber != null).map(m => [m.matchNumber, { home: m.home, away: m.away }]),
)

function splitWeighted(split, phase) {
  return {
    gep: weightedPts(split.gep, phase),
    res: weightedPts(split.resultado, phase),
    adv: weightedPts(split.advance, phase),
  }
}

function ptCell(n) {
  return n ? n : ''
}

function sumSplits(...parts) {
  return round1(parts.reduce((a, p) => a + (p.gep || 0) + (p.res || 0) + (p.adv || 0), 0))
}

const emptyPts = { gep: 0, res: 0, adv: 0 }

const headers = [
  'Partido',
  'Resultado real (90\')',
  'Quién pasa (real)',
  'Inicio (marcador)',
  'Cruce Inicio (KO)',
  'Eliminatorias (marcador)',
  'Inicio G/E/P',
  'Inicio Resultado',
  'Inicio Pasa',
  'Elim G/E/P',
  'Elim Resultado',
  'Elim Pasa',
  'Suma',
]

const SUM_COL_IDX = headers.length - 1
const LABEL_COL_IDX = headers.length - 2

function footerRow(label, value) {
  const row = Array(headers.length).fill('')
  row[LABEL_COL_IDX] = label
  row[SUM_COL_IDX] = value
  return row
}

const rows = []

for (const m of catalog) {
  const n = m.matchNumber
  if (n == null) continue
  const teams = resolveTeamsForMatch(m, gmByNum, kmByNum)
  const real = getRealResult(n, results, apiById, kmByNum, gmByNum)

  let inicioPred = null
  let elimPred = null
  let inicioKoCruce = null
  let inicioPts = { ...emptyPts }
  let elimPts = { ...emptyPts }

  if (n <= 72) {
    const gmRow = gmByNum.get(n)
    inicioPred = gmRow ? preds.group?.[gmRow.id] : null
    if (inicioPred && real?.home != null) {
      inicioPts = splitWeighted(calcMatchPointsSplit(inicioPred, real), 'inicio')
    }
  } else {
    inicioKoCruce = inicioCruceByNum.get(n) || inicioState.inicioPredictedByNum?.[n] || null
    const kmRow = kmByNum.get(n) || { ...m, id: m.id, matchNumber: n, home: teams?.home, away: teams?.away }
    inicioPred = lookupInicioKoPred(inicioKoPreds, kmRow)
    elimPred = lookupEliminatoriasKoPred(preds.knockout, elimScheduleByNum.get(n) || kmRow)

    if (inicioPred) {
      inicioPts = splitWeighted(
        calcInicioKnockoutPointsForId(inicioKoMatchId(n), inicioPred, inicioState),
        'inicio',
      )
    }

    const elimMatch = elimScheduleByNum.get(n) || kmRow
    const rawRes = resolveKnockoutResult(elimMatch.id, results.knockout, koCtx)
    if (elimPred && rawRes?.home != null) {
      const res = enrichKnockoutResultWithAdvances(rawRes, apiById[String(elimMatch.id)])
      let { predictedTeams, actualTeams } = resolveKnockoutTeamsForScoring(elimMatch.id, res, koCtx)
      if (actualTeams?.home && actualTeams?.away) predictedTeams = actualTeams
      elimPts = splitWeighted(
        calcMatchPointsSplit(elimPred, res, {
          knockout: true,
          predictedTeams,
          actualTeams,
        }),
        'elim',
      )
    }
  }

  const sum = sumSplits(inicioPts, elimPts)
  const inicioPredTeams = n >= 73 ? (inicioKoCruce || teams) : teams

  rows.push([
    buildMatchLabel({ ...m, home: teams?.home, away: teams?.away, group: gmByNum.get(n)?.group }),
    formatScore(real),
    formatAdvance(real, teams),
    formatPredWithAdvance(inicioPred, inicioPredTeams),
    n >= 73 ? formatCruce(inicioKoCruce) : '',
    n >= 73 ? formatPredWithAdvance(elimPred, teams) : '',
    ptCell(inicioPts.gep),
    ptCell(inicioPts.res),
    ptCell(inicioPts.adv),
    ptCell(elimPts.gep),
    ptCell(elimPts.res),
    ptCell(elimPts.adv),
    ptCell(sum),
  ])
}

const qual = calcGroupQualificationPoints({ predictions: preds }, scoringOpts)
for (const slot of qual.slots || []) {
  const inicioPts = {
    gep: weightedPts(slot.qualifiesPts, 'inicio'),
    res: weightedPts(slot.exactPts, 'inicio'),
    adv: 0,
  }
  const sum = sumSplits(inicioPts)
  rows.push([
    `Clasif. Grupo ${slot.group} — ${slot.team}`,
    `${slot.actualPosition}º real`,
    '',
    `${slot.predictedPosition}º previsto`,
    '',
    '',
    ptCell(inicioPts.gep),
    ptCell(inicioPts.res),
    '',
    '',
    '',
    '',
    ptCell(sum),
  ])
}

const cols = calcParticipantScoreColumns(
  { predictions: participant.predictions },
  group,
  scoringOpts,
)
const matchSum = round1(cols.inicioPts + cols.knockoutPts - cols.qualificationWeighted)
const qualSum = round1(cols.qualificationWeighted)
const rankingTotal = cols.total

rows.push(footerRow('Subtotal partidos', matchSum))
if (qualSum > 0) {
  rows.push(footerRow('Subtotal clasificación', qualSum))
}
rows.push(footerRow('TOTAL ranking', rankingTotal))

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const safeName = participant.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
const defaultOut = join(root, 'exports', `${safeName.toLowerCase()}-puntos.csv`)
const outPath = OUT_ARG ? OUT_ARG : defaultOut
mkdirSync(dirname(outPath), { recursive: true })

function csvEscape(val) {
  const s = val == null ? '' : String(val)
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const csv = `\uFEFF${[headers, ...rows].map(r => r.map(csvEscape).join(';')).join('\r\n')}\r\n`
writeFileSync(outPath, csv, 'utf8')

const xlsxPath = outPath.replace(/\.csv$/i, '.xlsx')
try {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 42 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 11 },
    { wch: 11 },
    { wch: 11 },
    { wch: 11 },
    { wch: 11 },
    { wch: 11 },
    { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, participant.name.slice(0, 31))
  XLSX.writeFile(wb, xlsxPath)
} catch (e) {
  console.warn('No se pudo generar .xlsx:', e.message)
}

console.log(JSON.stringify({
  participant: participant.name,
  group: group.name,
  matches: catalog.length,
  matchPts: matchSum,
  qualificationPts: qualSum,
  totalPts: rankingTotal,
  output: outPath,
  xlsx: xlsxPath,
  scoring: {
    gep: SCORING.correctOutcome,
    exact: SCORING.exactScore,
    advance: SCORING.knockoutAdvance,
    inicioWeight: PHASE_WEIGHT.inicio,
    elimWeight: PHASE_WEIGHT.knockoutReal,
  },
}, null, 2))
