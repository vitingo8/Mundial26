/**
 * Compara puntuación entre commits (sin datos reales de usuario: usa preds de ejemplo
 * basadas en los octavos Paraguay-Francia y Canadá-Marruecos).
 * Uso: node scripts/compare-scoring-commits.mjs
 */
import { execSync } from 'node:child_process'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { indexApiMatches } from '../lib/apiMatchScores.js'
import { getApiMatchDisplayScore } from '../lib/apiMatchScores.js'

const data = await getWcMatchesSafe()
const groupMatches = transformGroupMatches(data.matches)
const knockoutMatches = transformKnockoutMatches(data.matches)
const apiById = indexApiMatches(data.matches)

const pyFr = knockoutMatches.find(m => m.id === '4653842')
const caMa = knockoutMatches.find(m => m.id === '4653843')

function apiResult(id) {
  const raw = apiById[id]
  if (!raw) return null
  const s = getApiMatchDisplayScore(raw)
  return s ? { ...s, matchNumber: raw.matchNumber } : null
}

// Predicciones típicas según captura (+4 en UI = 3 GEP + 1 pasa)
const participant = {
  predictions: {
    group: {},
    inicioKnockout: {},
    knockout: {
      '4653842': { home: 1, away: 3, advances: 'away' },
      '4653843': { home: 0, away: 2, advances: 'away' },
    },
    bonuses: {},
  },
}

const group = {
  results: {
    group: {},
    knockout: {
      '4653842': apiResult('4653842'),
      '4653843': apiResult('4653843'),
    },
  },
  actuals: {},
}

const scoringOpts = {
  groupMatches,
  knockoutMatches,
  apiMatches: data.matches,
}

const cols = calcParticipantScoreColumns(participant, group, scoringOpts)

function koBreakdown(participant, group, km) {
  const c = calcParticipantScoreColumns(participant, group, { ...scoringOpts, knockoutMatches: km })
  return c
}

console.log('=== Octavos en catálogo actual ===')
console.log(`Paraguay-Francia: P${pyFr?.matchNumber} (${pyFr?.home} vs ${pyFr?.away})`)
console.log(`Canadá-Marruecos: P${caMa?.matchNumber} (${caMa?.home} vs ${caMa?.away})`)
console.log('\n=== Con fix actual (ambos octavos con número FIFA) ===')
console.log(JSON.stringify({
  knockoutPts: cols.knockoutPts,
  knockoutRawPts: cols.knockoutRawPts,
}, null, 2))

// Simular bug antiguo: Paraguay-Francia sin matchNumber (huérfano)
const kmBroken = knockoutMatches.map(m =>
  m.id === '4653842' ? { ...m, matchNumber: undefined, fifaMatchLabel: null } : m,
)
const colsBroken = koBreakdown(participant, group, kmBroken)

console.log('\n=== Simulación bug anterior (Paraguay-Francia sin número FIFA) ===')
console.log(JSON.stringify({
  total: colsBroken.total,
  knockoutPts: colsBroken.knockoutPts,
  knockoutRawPts: colsBroken.knockoutRawPts,
}, null, 2))
console.log(`  Diferencia eliminatorias ponderadas: +${+(cols.knockoutPts - colsBroken.knockoutPts).toFixed(1)} (raw +${cols.knockoutRawPts - colsBroken.knockoutRawPts})`)

// Simular doble conteo mismo slot (2 preds mismo matchNumber 89)
const participantDup = {
  predictions: {
    group: {},
    inicioKnockout: {},
    knockout: {
      '4653842': { home: 1, away: 3, advances: 'away' },
      '4653843': { home: 0, away: 2, advances: 'away' },
      'orphan-89': { home: 1, away: 3, advances: 'away' },
    },
    bonuses: {},
  },
}
const kmDup = [
  ...knockoutMatches,
  {
    id: 'orphan-89',
    matchNumber: 89,
    roundId: 'r16',
    home: 'Estados Unidos',
    away: 'Bosnia y Herzegovina',
    utcDate: '2026-07-02T22:00:00Z',
  },
]
const groupDup = {
  results: {
    group: {},
    knockout: {
      ...group.results.knockout,
      'orphan-89': { home: 2, away: 0, matchNumber: 89 },
    },
  },
  actuals: {},
}

function scoreAtCommit(commit) {
  const out = execSync(
    `git show ${commit}:lib/gameData.js`,
    { encoding: 'utf8', cwd: process.cwd() },
  )
  const hasList = out.includes('listEliminatoriasScoringMatches')
  const hasOldLoop = out.includes('Object.entries(preds.knockout')
  return { hasList, hasOldLoop }
}

console.log('\n=== Commits ===')
for (const [label, sha] of [['antes dedup', 'e6aac8a'], ['dedup', '009e367'], ['fifa fix', 'a8d8e61']]) {
  console.log(`  ${label} (${sha}):`, scoreAtCommit(sha))
}
