import { SCORING } from './gameData.js'
import { teamsMatch, normalizeTeamName } from './fifaMatchNumbers.js'
import { buildInicioKnockoutSchedule, parseInicioKoMatchNumber } from './knockoutBridge.js'
import { BRACKET_ROUND_ORDER, KNOCKOUT_ROUND_IDS } from './knockoutBracketDisplay.js'
import { buildNonQualifiedTeamsFromGroups } from './groupQualificationScoring.js'
import { isResolvedTeamName } from './knockoutMatchScoring.js'
import { resolveKnockoutWinnerTeam, enrichKnockoutResultWithAdvances } from './knockoutAdvances.js'
import { indexApiMatches } from './apiMatchScores.js'

export function knockoutRoundIdFromMatchNumber(matchNumber) {
  if (matchNumber == null || Number.isNaN(Number(matchNumber))) return null
  const n = Number(matchNumber)
  const round = BRACKET_ROUND_ORDER.find(r => n >= r.from && n <= r.to)
  return round?.id ?? null
}

export function knockoutPairKey(teamA, teamB) {
  const a = normalizeTeamName(teamA)
  const b = normalizeTeamName(teamB)
  if (!a || !b) return null
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function teamsPairMatches(homeA, awayA, homeB, awayB) {
  const keyA = knockoutPairKey(homeA, awayA)
  const keyB = knockoutPairKey(homeB, awayB)
  return keyA != null && keyA === keyB
}

function teamGoalsFromRow(scoreRow, teams) {
  const nh = normalizeTeamName(teams.home)
  const na = normalizeTeamName(teams.away)
  return {
    [nh]: Number(scoreRow.home),
    [na]: Number(scoreRow.away),
  }
}

function teamOutcomeMatches(pred, predTeams, res, resTeams) {
  const predGoals = teamGoalsFromRow(pred, predTeams)
  const resGoals = teamGoalsFromRow(res, resTeams)
  const nh = normalizeTeamName(predTeams.home)
  const na = normalizeTeamName(predTeams.away)
  const pDiff = predGoals[nh] - predGoals[na]
  const rDiff = resGoals[nh] - resGoals[na]
  if (pDiff === 0 && rDiff === 0) return true
  if (pDiff > 0 && rDiff > 0) return true
  if (pDiff < 0 && rDiff < 0) return true
  return false
}

function teamExactScoreMatches(pred, predTeams, res, resTeams) {
  const predGoals = teamGoalsFromRow(pred, predTeams)
  const resGoals = teamGoalsFromRow(res, resTeams)
  const nh = normalizeTeamName(predTeams.home)
  const na = normalizeTeamName(predTeams.away)
  return predGoals[nh] === resGoals[nh] && predGoals[na] === resGoals[na]
}

function resolveTeamsFromEntry(entry, teamsFallback) {
  const home = entry?.homeTeam || entry?.home || teamsFallback?.home
  const away = entry?.awayTeam || entry?.away || teamsFallback?.away
  if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) return null
  return { home, away }
}

function ensureRoundBucket(state, roundId) {
  if (!state.pairIndexByRound[roundId]) state.pairIndexByRound[roundId] = {}
  if (!state.teamIndexByRound[roundId]) state.teamIndexByRound[roundId] = {}
}

function registerKnockoutMatch(state, home, away, data) {
  const teams = resolveTeamsFromEntry(data, { home, away })
  if (!teams) return

  const roundId = data.roundId ?? knockoutRoundIdFromMatchNumber(data.matchNumber)
  if (!roundId) return

  ensureRoundBucket(state, roundId)

  const key = knockoutPairKey(teams.home, teams.away)
  if (!key) return

  const existing = state.pairIndexByRound[roundId][key]
  const hasResult = data.result?.home != null && data.result?.away != null
  const existingHasResult = existing?.result?.home != null && existing?.result?.away != null
  const entry = { ...data, teams, roundId }
  if (!existing || (hasResult && !existingHasResult)) {
    state.pairIndexByRound[roundId][key] = entry
  }

  for (const name of [teams.home, teams.away]) {
    const nt = normalizeTeamName(name)
    if (!nt) continue
    const list = state.teamIndexByRound[roundId][nt] || (state.teamIndexByRound[roundId][nt] = [])
    if (!list.some(m => m.matchNumber === data.matchNumber && m.id === data.id)) {
      list.push(entry)
    }
  }

  if (data.matchNumber != null) {
    state.actualByMatchNumber[data.matchNumber] = { ...teams, roundId }
  }
}

/**
 * Índice de cruces reales (API + resultados publicados) y equipos del bracket Inicio.
 */
export function buildInicioKnockoutScoringState(
  participant,
  {
    groupMatches = [],
    knockoutMatches = [],
    knockoutResults = {},
    groupResults = {},
    fotmobStandings = null,
    apiMatches = [],
  } = {},
) {
  const preds = participant?.predictions || {}
  const { schedule } = buildInicioKnockoutSchedule(
    groupMatches,
    preds.group || {},
    preds.inicioKnockout || {},
  )

  const inicioPredictedById = {}
  const inicioPredictedByNum = {}
  for (const m of schedule) {
    if (!m.id) continue
    inicioPredictedById[m.id] = {
      home: m.home,
      away: m.away,
      matchNumber: m.matchNumber,
      roundId: m.roundId ?? knockoutRoundIdFromMatchNumber(m.matchNumber),
    }
    if (m.matchNumber != null) {
      inicioPredictedByNum[m.matchNumber] = { home: m.home, away: m.away, id: m.id }
    }
  }

  const state = {
    pairIndexByRound: {},
    teamIndexByRound: {},
    actualByMatchNumber: {},
    inicioPredictedById,
    inicioPredictedByNum,
  }
  const apiById = indexApiMatches(apiMatches)

  function enrichPublishedResult(res, { id, matchNumber, apiRow = null } = {}) {
    if (!res) return null
    const api =
      apiRow
      ?? apiById[String(id)]
      ?? (matchNumber != null
        ? (knockoutMatches || []).find(km => km.matchNumber === matchNumber)
        : null)
    return enrichKnockoutResultWithAdvances(res, api)
  }

  for (const m of knockoutMatches || []) {
    if (m.matchNumber == null) continue
    const teams = resolveTeamsFromEntry(m, m)
    if (!teams) continue
    const resId = String(m.id)
    const publishedRaw =
      knockoutResults?.[resId] ??
      knockoutResults?.[`inicio-ko-${m.matchNumber}`] ??
      Object.values(knockoutResults || {}).find(
        r => r?.matchNumber === m.matchNumber && r?.home != null,
      )
    const published = enrichPublishedResult(publishedRaw, {
      id: resId,
      matchNumber: m.matchNumber,
      apiRow: apiById[resId] || m,
    })
    registerKnockoutMatch(state, teams.home, teams.away, {
      id: resId,
      matchNumber: m.matchNumber,
      roundId: m.roundId ?? knockoutRoundIdFromMatchNumber(m.matchNumber),
      result: published || null,
      teams,
    })
  }

  for (const [id, res] of Object.entries(knockoutResults || {})) {
    if (res?.home == null || res?.away == null) continue
    const matchNum =
      res.matchNumber ??
      parseInicioKoMatchNumber(id) ??
      (() => {
        const km = (knockoutMatches || []).find(k => String(k.id) === id)
        return km?.matchNumber ?? null
      })()

    const fallback =
      inicioPredictedById[id] ??
      (matchNum != null ? inicioPredictedByNum[matchNum] : null) ??
      (matchNum != null
        ? (knockoutMatches || []).find(km => km.matchNumber === matchNum)
        : null)

    const teams = resolveTeamsFromEntry(res, fallback)
    if (!teams) continue

    registerKnockoutMatch(state, teams.home, teams.away, {
      id,
      matchNumber: matchNum,
      roundId: knockoutRoundIdFromMatchNumber(matchNum),
      result: enrichPublishedResult(res, { id, matchNumber: matchNum }),
      teams,
    })
  }

  state.eliminatedTeams = buildEliminatedTeams(state)
  state.nonQualifiedTeams = buildNonQualifiedTeamsFromGroups({
    groupMatches,
    knockoutMatches,
    fotmobStandings,
    apiMatches,
    groupResults,
  })

  return state
}

/** Cruce real en la misma fase (dieciseisavos, octavos…). */
export function findRealKnockoutMatchForPair(home, away, state, matchNumber) {
  const roundId = knockoutRoundIdFromMatchNumber(matchNumber)
  const key = knockoutPairKey(home, away)
  if (!roundId || !key || !state?.pairIndexByRound) return null
  return state.pairIndexByRound[roundId]?.[key] ?? null
}

function knockoutRoundOrder(roundId) {
  const i = KNOCKOUT_ROUND_IDS.indexOf(roundId)
  return i >= 0 ? i : Infinity
}

function buildEliminatedTeams(state) {
  const eliminated = new Map()
  for (const round of BRACKET_ROUND_ORDER) {
    const bucket = state.pairIndexByRound?.[round.id]
    if (!bucket) continue
    for (const entry of Object.values(bucket)) {
      if (!isKnockoutMatchFinished(entry)) continue
      const winner = resolveKnockoutWinnerTeam(entry.result, entry.teams)
      if (!winner?.name) continue
      for (const name of [entry.teams.home, entry.teams.away]) {
        if (teamsMatch(name, winner.name)) continue
        const nt = normalizeTeamName(name)
        if (nt && !eliminated.has(nt)) eliminated.set(nt, round.id)
      }
    }
  }
  return eliminated
}

function ensureEliminatedTeams(state) {
  if (!state.eliminatedTeams) {
    state.eliminatedTeams = buildEliminatedTeams(state)
  }
  return state.eliminatedTeams
}

function isNonQualifiedTeam(team, state) {
  const nt = normalizeTeamName(team)
  if (!nt || !state?.nonQualifiedTeams?.size) return false
  if (state.nonQualifiedTeams.has(nt)) return true
  for (const nq of state.nonQualifiedTeams) {
    if (teamsMatch(nq, team)) return true
  }
  return false
}

/** Perdedor de KO que ya no puede aparecer en la fase prevista. */
function teamEliminationBlocksPrediction(team, predictedRoundId, state) {
  const nt = normalizeTeamName(team)
  if (!nt || !predictedRoundId) return false
  const lossRound = ensureEliminatedTeams(state).get(nt)
  if (!lossRound) return false
  if (lossRound === 'sf' && predictedRoundId === '3rd') return false
  return knockoutRoundOrder(predictedRoundId) >= knockoutRoundOrder(lossRound)
}

function isKnockoutMatchFinished(entry) {
  return entry?.result?.home != null && entry?.result?.away != null
}

function findRegisteredMatchByNumber(state, matchNumber) {
  const roundId = knockoutRoundIdFromMatchNumber(matchNumber)
  if (!roundId || matchNumber == null) return null
  const bucket = state.pairIndexByRound?.[roundId]
  if (!bucket) return null
  return Object.values(bucket).find(m => m.matchNumber === matchNumber) ?? null
}

/** Dieciseisavos: cruces fijos en cuanto hay equipos. Fases siguientes: solo cuando ya jugaron. */
function shouldVoidImpossiblePairing(roundId, ...entries) {
  if (roundId === 'r32') return true
  return entries.some(isKnockoutMatchFinished)
}

function getTeamAssignmentInRound(team, roundId, state) {
  const nt = normalizeTeamName(team)
  if (!nt || !roundId) return null
  const list = state.teamIndexByRound?.[roundId]?.[nt] || []
  return list.find(m => isResolvedTeamName(m.teams?.home) && isResolvedTeamName(m.teams?.away)) ?? list[0] ?? null
}

function pairingMatchesAssignment(home, away, assignment) {
  if (!assignment?.teams) return false
  return teamsPairMatches(home, away, assignment.teams.home, assignment.teams.away)
}

function hasFinishedKnockoutMatchInRound(team, roundId, state) {
  const nt = normalizeTeamName(team)
  if (!nt) return false
  return (state.teamIndexByRound?.[roundId]?.[nt] || []).some(
    m => m.result?.home != null && m.result?.away != null,
  )
}

function hasFinishedMatchAgainstOtherInRound(team, opponent, roundId, state) {
  const nt = normalizeTeamName(team)
  if (!nt) return false
  return (state.teamIndexByRound?.[roundId]?.[nt] || []).some(m => {
    if (m.result?.home == null || m.result?.away == null) return false
    const other = teamsMatch(m.teams.home, team) ? m.teams.away : m.teams.home
    return !teamsMatch(other, opponent)
  })
}

/** Partido previsto que ya no puede puntuar en su fase (cruce imposible en esa ronda). */
export function getInicioKnockoutUiStatus(home, away, matchNumber, state) {
  if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) {
    return { void: false, pending: true, label: null }
  }

  const roundId = knockoutRoundIdFromMatchNumber(matchNumber)
  if (!roundId) {
    return { void: false, pending: true, label: null }
  }

  if (findRealKnockoutMatchForPair(home, away, state, matchNumber)) {
    return { void: false, pending: false, label: null }
  }

  if (isNonQualifiedTeam(home, state) || isNonQualifiedTeam(away, state)) {
    return { void: true, pending: false, label: '0 pts' }
  }

  if (
    teamEliminationBlocksPrediction(home, roundId, state) ||
    teamEliminationBlocksPrediction(away, roundId, state)
  ) {
    return { void: true, pending: false, label: '0 pts' }
  }

  const slotTeams = matchNumber != null ? state?.actualByMatchNumber?.[matchNumber] : null
  const slotEntry = findRegisteredMatchByNumber(state, matchNumber)
  if (
    slotTeams &&
    knockoutRoundIdFromMatchNumber(matchNumber) === roundId &&
    isResolvedTeamName(slotTeams.home) &&
    isResolvedTeamName(slotTeams.away) &&
    !teamsPairMatches(home, away, slotTeams.home, slotTeams.away) &&
    shouldVoidImpossiblePairing(roundId, slotEntry)
  ) {
    return { void: true, pending: false, label: '0 pts' }
  }

  const homeAssign = getTeamAssignmentInRound(home, roundId, state)
  const awayAssign = getTeamAssignmentInRound(away, roundId, state)

  if (
    homeAssign &&
    !pairingMatchesAssignment(home, away, homeAssign) &&
    shouldVoidImpossiblePairing(roundId, homeAssign)
  ) {
    return { void: true, pending: false, label: '0 pts' }
  }
  if (
    awayAssign &&
    !pairingMatchesAssignment(home, away, awayAssign) &&
    shouldVoidImpossiblePairing(roundId, awayAssign)
  ) {
    return { void: true, pending: false, label: '0 pts' }
  }
  if (
    homeAssign &&
    awayAssign &&
    homeAssign.matchNumber != null &&
    awayAssign.matchNumber != null &&
    homeAssign.matchNumber !== awayAssign.matchNumber &&
    shouldVoidImpossiblePairing(roundId, homeAssign, awayAssign)
  ) {
    return { void: true, pending: false, label: '0 pts' }
  }

  const homeFinishedOther = hasFinishedMatchAgainstOtherInRound(home, away, roundId, state)
  const awayFinishedOther = hasFinishedMatchAgainstOtherInRound(away, home, roundId, state)
  if (
    (homeFinishedOther && hasFinishedKnockoutMatchInRound(away, roundId, state)) ||
    (awayFinishedOther && hasFinishedKnockoutMatchInRound(home, roundId, state)) ||
    (homeFinishedOther && awayFinishedOther)
  ) {
    return { void: true, pending: false, label: '0 pts' }
  }

  return { void: false, pending: true, label: null }
}

function calcInicioKnockoutAdvanceBonus(pred, predictedTeams, state, matchNumber) {
  const pickedWinner = resolveKnockoutWinnerTeam(pred, predictedTeams)
  if (!pickedWinner?.name) return 0

  const roundId = knockoutRoundIdFromMatchNumber(matchNumber)
  if (!roundId) return 0

  const nt = normalizeTeamName(pickedWinner.name)
  const teamMatches = state.teamIndexByRound?.[roundId]?.[nt] || []
  const finished = teamMatches.find(m => m.result?.home != null && m.result?.away != null)
  if (!finished) return 0

  const realWinner = resolveKnockoutWinnerTeam(finished.result, finished.teams)
  if (!realWinner?.name) return 0
  return teamsMatch(pickedWinner.name, realWinner.name) ? 1 : 0
}

/**
 * Puntos KO previsto (Inicio ×0,6): G/E/P y exacto solo si el par jugó en la misma fase;
 * +1 de clasificado si acertaste al equipo en su partido de esa fase.
 */
export function calcInicioKnockoutPointsSplit(pred, predictedTeams, state, matchNumber) {
  if (!pred || !predictedTeams?.home || !predictedTeams?.away) {
    return { gep: 0, resultado: 0, advance: 0 }
  }
  if (!isResolvedTeamName(predictedTeams.home) || !isResolvedTeamName(predictedTeams.away)) {
    return { gep: 0, resultado: 0, advance: 0 }
  }

  const num =
    matchNumber ??
    predictedTeams.matchNumber ??
    null

  let gep = 0
  let resultado = 0

  const real = findRealKnockoutMatchForPair(
    predictedTeams.home,
    predictedTeams.away,
    state,
    num,
  )
  const realResult = real?.result
  const realTeams = real?.teams

  const roundId = knockoutRoundIdFromMatchNumber(num)
  if (
    !real &&
    (isNonQualifiedTeam(predictedTeams.home, state) ||
      isNonQualifiedTeam(predictedTeams.away, state))
  ) {
    return { gep: 0, resultado: 0, advance: 0 }
  }

  if (
    !real &&
    roundId &&
    (teamEliminationBlocksPrediction(predictedTeams.home, roundId, state) ||
      teamEliminationBlocksPrediction(predictedTeams.away, roundId, state))
  ) {
    return { gep: 0, resultado: 0, advance: 0 }
  }

  if (realResult?.home != null && realResult?.away != null && realTeams) {
    if (teamOutcomeMatches(pred, predictedTeams, realResult, realTeams)) {
      gep = SCORING.correctOutcome
    }
    if (teamExactScoreMatches(pred, predictedTeams, realResult, realTeams)) {
      resultado = SCORING.exactScore
    }
  }

  const advance =
    calcInicioKnockoutAdvanceBonus(pred, predictedTeams, state, num) * SCORING.knockoutAdvance

  return { gep, resultado, advance }
}

export function calcInicioKnockoutPointsForId(id, pred, state) {
  const predictedTeams =
    state?.inicioPredictedById?.[id] ??
    (() => {
      const num = parseInicioKoMatchNumber(id)
      return num != null ? state?.inicioPredictedByNum?.[num] : null
    })()
  const matchNumber =
    predictedTeams?.matchNumber ??
    parseInicioKoMatchNumber(id)
  return calcInicioKnockoutPointsSplit(pred, predictedTeams, state, matchNumber)
}

export function summarizeInicioKnockoutMatchPoints(pred, predictedTeams, state, matchNumber) {
  if (!pred) return null
  const num = matchNumber ?? predictedTeams?.matchNumber
  const split = calcInicioKnockoutPointsSplit(pred, predictedTeams, state, num)
  const pts = split.gep + split.resultado + split.advance
  const parts = []
  if (split.gep > 0) parts.push(`+${SCORING.correctOutcome} (1X2)`)
  if (split.resultado > 0) parts.push(`+${SCORING.exactScore} exacto`)
  if (split.advance > 0) parts.push(`+${SCORING.knockoutAdvance} pasa`)
  return {
    pts,
    detail: pts === 0 ? 'Sin puntos' : parts.join(' · '),
    parts,
    split,
  }
}
