/**
 * Benchmark del arranque del dashboard: replica el trabajo que hace el cliente
 * en el primer render con datos reales de FotMob para localizar el bloqueo.
 * Uso: node scripts/perf-bench.mjs
 */
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { migrateParticipantPredictions } from '../lib/matchIdMap.js'
import { normalizeInicioKoPreds, buildEliminatoriasKnockoutSchedule, buildInicioKnockoutSchedule } from '../lib/knockoutBridge.js'
import { buildKnockoutScoringContext, resolveKnockoutTeamsForScoring } from '../lib/knockoutMatchScoring.js'
import { buildInicioKnockoutScoringState, getInicioKnockoutUiStatus, summarizeInicioKnockoutMatchPoints } from '../lib/inicioKnockoutScoring.js'
import { buildLiveKnockoutMatches } from '../lib/hydrateKnockoutR32.js'
import { getEliminatoriasReminderMatches } from '../lib/eliminatoriasReminder.js'
import { buildPublishedResultsMap, summarizeMatchPoints } from '../lib/matchPointsDisplay.js'
import { getParticipantPredsForMatch } from '../lib/participantMatchPreds.js'
import { calcLeaderboard } from '../lib/gameData.js'
import { getScoringDisputedLimits } from '../lib/scoringMaximum.js'
import { indexApiMatches } from '../lib/apiMatchScores.js'
import { buildDayTabs, matchDateKey, todayDateKey, scheduleAnchorDateKey } from '../lib/matchSchedule.js'
import { enrichKnockoutResultWithAdvances } from '../lib/knockoutRegulationScore.js'
import { getApiMatchDisplayScore } from '../lib/apiMatchScores.js'

function time(label, fn) {
  const t0 = performance.now()
  const out = fn()
  const ms = performance.now() - t0
  console.log(`${label.padEnd(60)} ${ms.toFixed(1)} ms`)
  return out
}

const data = await getWcMatchesSafe()
console.log(`fuente=${data._source} partidos=${data.matches.length} standings=${Boolean(data.standings?.ready)}`)

const apiMatches = data.matches
const fotmobStandings = data.standings

const groupMatches = time('transformGroupMatches', () => transformGroupMatches(apiMatches))
const knockoutMatches = time('transformKnockoutMatches', () => transformKnockoutMatches(apiMatches))

// Predicciones sintéticas completas (equivalente a un usuario con todo relleno)
const groupPreds = {}
for (const m of groupMatches) groupPreds[m.id] = { home: 1, away: 0 }
const inicioKoPreds = {}
for (let n = 73; n <= 104; n++) inicioKoPreds[`inicio-ko-${n}`] = { home: 1, away: 0 }
const koPreds = {}
for (const m of knockoutMatches) koPreds[m.id] = { home: 1, away: 0, advances: 'home' }

const rawPreds = { group: groupPreds, knockout: koPreds, inicioKnockout: inicioKoPreds, bonuses: {} }

// 10 participantes
const participants = {}
for (let i = 0; i < 10; i++) {
  participants[`p${i}`] = { id: `p${i}`, name: `Jugador ${i}`, predictions: rawPreds }
}
const group = {
  id: 'bench',
  phase: 'knockout',
  participants,
  results: { group: {}, knockout: {} },
  actuals: {},
}

const user = { id: 'p0', predictions: rawPreds }

// ── usePredictions: hidratación ──
const migrated = time('hydratePredictions (migrateParticipantPredictions)', () =>
  migrateParticipantPredictions(rawPreds, groupMatches, knockoutMatches),
)
time('normalizeInicioKoPreds', () => normalizeInicioKoPreds(rawPreds.inicioKnockout))

// ── KnockoutPreds (render inicial, predPhase=knockout) ──
const scheduleMatches = time('buildEliminatoriasKnockoutSchedule', () =>
  buildEliminatoriasKnockoutSchedule(knockoutMatches, migrated.knockout, {
    fotmobStandings, groupMatches, apiMatches,
  }),
)
const knockoutScoringCtx = time('buildKnockoutScoringContext', () =>
  buildKnockoutScoringContext(user, {
    groupMatches, knockoutMatches, koPreds: migrated.knockout, fotmobStandings, apiMatches,
  }),
)
const publishedResults = time('buildPublishedResultsMap (knockout)', () =>
  buildPublishedResultsMap(group.results, 'knockout', knockoutMatches),
)
time('buildLiveKnockoutMatches', () =>
  buildLiveKnockoutMatches(knockoutMatches, fotmobStandings, groupMatches, apiMatches),
)
// ── EliminatoriasReminderDialog ──
time('getEliminatoriasReminderMatches', () =>
  getEliminatoriasReminderMatches({
    knockoutMatches, koPreds: migrated.knockout, fotmobStandings, groupMatches, apiMatches,
    dismissedIds: [], groupPhase: 'knockout',
  }),
)

// ── GroupPhasePreds (predPhase=group) ──
const inicioKo = time('buildInicioKnockoutSchedule', () =>
  buildInicioKnockoutSchedule(groupMatches, migrated.group, migrated.inicioKnockout ?? inicioKoPreds),
)
const inicioScoring = time('buildInicioKnockoutScoringState', () =>
  buildInicioKnockoutScoringState(user, {
    groupMatches, knockoutMatches,
    knockoutResults: group.results.knockout, groupResults: group.results.group,
    fotmobStandings, apiMatches,
  }),
)

// ── MatchDaySchedule: día seleccionado ──
const rawById = time('indexApiMatches', () => indexApiMatches(apiMatches))
const days = time('buildDayTabs', () => buildDayTabs(scheduleMatches, { phase: 'knockout' }))
const today = todayDateKey()
const anchor = scheduleAnchorDateKey('knockout')
const selectedDay = days.find(d => d.key === today)?.key ?? days.find(d => d.key === anchor)?.key ?? days[0]?.key
const dayMatches = scheduleMatches.filter(m => matchDateKey(m.utcDate) === selectedDay)
console.log(`día seleccionado=${selectedDay} partidos en el día=${dayMatches.length}`)

// Trabajo por fila (MatchRow) para el día visible
time(`MatchRow x${dayMatches.length}: resolveKnockoutTeamsForScoring`, () => {
  for (const m of dayMatches) resolveKnockoutTeamsForScoring(m.id, publishedResults[m.id], knockoutScoringCtx)
})
time(`MatchRow x${dayMatches.length}: getParticipantPredsForMatch (10 part.)`, () => {
  for (const m of dayMatches) {
    getParticipantPredsForMatch(participants, m.id, { groupMatches, knockoutMatches, match: m })
  }
})
time(`MatchRow x${dayMatches.length}: summarizeMatchPoints + enrich`, () => {
  for (const m of dayMatches) {
    const apiRaw = rawById[m.id]
    const pred = migrated.knockout[m.id] || { home: 1, away: 0 }
    const base = publishedResults[m.id] || (apiRaw ? getApiMatchDisplayScore(apiRaw) : null)
    const res = base && apiRaw ? enrichKnockoutResultWithAdvances(base, apiRaw) : base
    if (res) summarizeMatchPoints(pred, res, { knockout: true })
  }
})
time(`MatchRow x${dayMatches.length}: getInicioKnockoutUiStatus`, () => {
  for (const m of dayMatches) {
    getInicioKnockoutUiStatus(m.home, m.away, m.matchNumber, inicioScoring)
  }
})

// ── GroupTab (Ranking) — no inicial, pero por comparar ──
const scoringOpts = { groupMatches, knockoutMatches, fotmobStandings, apiMatches }
const scoringGroup = { ...group }
const leaderboard = time('calcLeaderboard (10 participantes)', () => calcLeaderboard(scoringGroup, scoringOpts))
time('getScoringDisputedLimits', () => getScoringDisputedLimits(scoringGroup, scoringOpts))
void leaderboard
