import { teamsMatch } from './fifaMatchNumbers.js'
import {
  buildEliminatoriasKnockoutSchedule,
  buildInicioKnockoutSchedule,
  inicioKoMatchId,
  knockoutRealKoMatchId,
  parseKnockoutRealKoMatchNumber,
} from './knockoutBridge.js'

/** Etiqueta FIFA (1A, W74…) — no es un equipo resuelto. */
export function isResolvedTeamName(name) {
  if (name == null || name === '') return false
  const n = String(name).trim()
  if (n === '—') return false
  return !/^[123WLPG][\dA-L/]*$/.test(n)
}

/** Ambos cruces (local y visitante) coinciden con la realidad. */
export function knockoutMatchupMatches(predictedTeams, actualTeams) {
  if (!isResolvedTeamName(predictedTeams?.home) || !isResolvedTeamName(predictedTeams?.away)) {
    return false
  }
  if (!isResolvedTeamName(actualTeams?.home) || !isResolvedTeamName(actualTeams?.away)) {
    return false
  }
  return (
    teamsMatch(predictedTeams.home, actualTeams.home) &&
    teamsMatch(predictedTeams.away, actualTeams.away)
  )
}

function parseBracketMatchNumber(id) {
  const m = String(id).match(/^bracket-(\d+)$/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Mapas por número FIFA (73–104) para puntuar eliminatorias.
 * - predictedByNum: cruces según tu bracket de Inicio
 * - actualByNum: cruces reales (API / resultados guardados)
 */
export function buildKnockoutScoringContext(
  participant,
  { groupMatches = [], knockoutMatches = [], koPreds } = {},
) {
  const preds = participant?.predictions || {}
  const knockoutPreds = koPreds ?? preds.knockout ?? {}

  const elimSchedule = buildEliminatoriasKnockoutSchedule(knockoutMatches, knockoutPreds)

  const predictedByNum = {}
  for (const m of elimSchedule) {
    if (m.matchNumber == null) continue
    if (!isResolvedTeamName(m.home) || !isResolvedTeamName(m.away)) continue
    predictedByNum[m.matchNumber] = { home: m.home, away: m.away }
  }

  const actualByNum = {}
  const idToMatchNumber = {}

  for (const m of knockoutMatches || []) {
    if (m.matchNumber == null) continue
    idToMatchNumber[String(m.id)] = m.matchNumber
    if (isResolvedTeamName(m.home) && isResolvedTeamName(m.away)) {
      actualByNum[m.matchNumber] = { home: m.home, away: m.away }
    }
  }

  for (const m of elimSchedule) {
    if (m.matchNumber == null || !m.id) continue
    idToMatchNumber[String(m.id)] = m.matchNumber
    const koId = knockoutRealKoMatchId(m.matchNumber)
    idToMatchNumber[koId] = m.matchNumber
  }

  const { schedule: inicioSchedule } = buildInicioKnockoutSchedule(
    groupMatches,
    preds.group || {},
    preds.inicioKnockout || {},
  )
  for (const m of inicioSchedule) {
    if (m.matchNumber == null || !m.id) continue
    idToMatchNumber[String(m.id)] = m.matchNumber
    idToMatchNumber[inicioKoMatchId(m.matchNumber)] = m.matchNumber
  }

  return { predictedByNum, actualByNum, idToMatchNumber, parseBracketMatchNumber }
}

/** Resultado publicado por id de predicción o por número FIFA. */
export function resolveKnockoutResult(predId, knockoutResults = {}, ctx = {}) {
  const direct = knockoutResults?.[predId]
  if (direct?.home != null && direct?.away != null) return direct
  const matchNum =
    ctx?.idToMatchNumber?.[String(predId)] ??
    parseKnockoutRealKoMatchNumber(predId) ??
    parseBracketMatchNumber(predId)
  if (matchNum == null) return null
  for (const res of Object.values(knockoutResults || {})) {
    if (res?.home != null && res?.away != null && res.matchNumber === matchNum) {
      return res
    }
  }
  return null
}

export function resolveKnockoutTeamsForScoring(matchId, result, ctx) {
  const id = String(matchId)
  const matchNum =
    ctx?.idToMatchNumber?.[id] ??
    result?.matchNumber ??
    parseKnockoutRealKoMatchNumber(id) ??
    parseBracketMatchNumber(id)

  const predictedTeams =
    matchNum != null ? ctx?.predictedByNum?.[matchNum] : undefined

  let actualTeams = matchNum != null ? ctx?.actualByNum?.[matchNum] : undefined
  if (!actualTeams && result?.homeTeam && result?.awayTeam) {
    actualTeams = { home: result.homeTeam, away: result.awayTeam }
  }

  return { matchNum, predictedTeams, actualTeams }
}
