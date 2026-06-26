import { teamsMatch } from './fifaMatchNumbers.js'
import { GROUP_LETTERS } from './groupQualificationScoring.js'
import { getCompletedGroupLetters, isGroupMatchFinished } from './groupStageCompletion.js'
import { thirdPlaceCombinationMap } from './knockout/dist/config/thirdPlaceCombinationMap.js'
import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'

/** @typedef {'qualified' | 'pending' | 'eliminated'} QualificationStatus */

/**
 * @typedef {object} ThirdPlaceStats
 * @property {string} group
 * @property {string} team
 * @property {number} pts
 * @property {number} gd
 * @property {number} gf
 * @property {number} gc
 * @property {number} pj
 * @property {number} fairPlay
 */

/**
 * @typedef {object} ThirdPlaceTeamState
 * @property {string} team
 * @property {string} group
 * @property {3} groupPosition
 * @property {number} points
 * @property {number} goalDifference
 * @property {number} goalsFor
 * @property {QualificationStatus} qualificationStatus
 * @property {boolean} bracketSlotResolved
 * @property {number} [resolvedMatchId]
 * @property {string} [resolvedOpponent]
 */

export function parseFotmobScoresStr(scoresStr) {
  const m = String(scoresStr || '').match(/^(\d+)-(\d+)$/)
  if (!m) return { gf: 0, gc: 0, gd: 0 }
  const gf = Number(m[1])
  const gc = Number(m[2])
  return { gf, gc, gd: gf - gc }
}

/** Criterios FIFA entre terceros: pts → DG → GF → fair play → grupo. */
export function compareThirdPlaceStats(a, b) {
  if (b.pts !== a.pts) return b.pts - a.pts
  if (b.gd !== a.gd) return b.gd - a.gd
  if (b.gf !== a.gf) return b.gf - a.gf
  const fpA = a.fairPlay ?? 0
  const fpB = b.fairPlay ?? 0
  if (fpB !== fpA) return fpB - fpA
  return String(a.group).localeCompare(String(b.group))
}

export function strictlyBeatsThird(challenger, target) {
  return compareThirdPlaceStats(challenger, target) < 0
}

function normalizeGroupKey(group) {
  if (!group) return null
  return String(group).replace(/^GROUP_/i, '').toUpperCase()
}

function remainingMatchesForTeam(teamName, groupLetter, groupMatches = [], apiMatches = [], played = 0) {
  const apiIndex = Object.fromEntries((apiMatches || []).map(m => [String(m.id), m]))
  const fromSchedule = (groupMatches || []).filter(m => {
    if (normalizeGroupKey(m.group) !== groupLetter) return false
    if (m.home !== teamName && m.away !== teamName) return false
    return !isGroupMatchFinished(apiIndex[String(m.id)])
  }).length
  if (fromSchedule > 0) return fromSchedule
  return Math.max(0, 3 - (played ?? 0))
}

/**
 * Cota optimista: mejor resultado posible del tercero actual (3-0 en lo que le queda).
 * @returns {ThirdPlaceStats | null}
 */
export function estimateMaxThirdStatsForGroup(groupLetter, thirdStats, groupMatches = [], apiMatches = []) {
  if (!thirdStats?.team) return null
  const remaining = remainingMatchesForTeam(
    thirdStats.team,
    groupLetter,
    groupMatches,
    apiMatches,
    thirdStats.pj,
  )
  const boostPts = remaining * 3
  const boostGd = remaining * 3
  const boostGf = remaining * 3
  return {
    group: groupLetter,
    team: thirdStats.team,
    pts: thirdStats.pts + boostPts,
    gd: thirdStats.gd + boostGd,
    gf: thirdStats.gf + boostGf,
    gc: thirdStats.gc,
    pj: thirdStats.pj + remaining,
    fairPlay: thirdStats.fairPlay ?? 0,
  }
}

/**
 * Cota pesimista: pierde lo pendiente 0-3.
 * @returns {ThirdPlaceStats | null}
 */
export function estimateMinThirdStatsForGroup(groupLetter, thirdStats, groupMatches = [], apiMatches = []) {
  if (!thirdStats?.team) return null
  const remaining = remainingMatchesForTeam(
    thirdStats.team,
    groupLetter,
    groupMatches,
    apiMatches,
    thirdStats.pj,
  )
  return {
    group: groupLetter,
    team: thirdStats.team,
    pts: thirdStats.pts,
    gd: thirdStats.gd - remaining * 3,
    gf: thirdStats.gf,
    gc: thirdStats.gc + remaining * 3,
    pj: thirdStats.pj + remaining,
    fairPlay: thirdStats.fairPlay ?? 0,
  }
}

/**
 * @param {ThirdPlaceStats} third
 * @param {ThirdPlaceStats[]} completedThirds
 * @param {Set<string>} completed
 * @param {Record<string, ThirdPlaceStats>} statsByGroup
 * @param {object} opts
 * @returns {QualificationStatus}
 */
export function calculateMathematicalQualificationStatus(
  third,
  completedThirds,
  completed,
  statsByGroup,
  { groupMatches = [], apiMatches = [] } = {},
) {
  if (!third?.team || !completed.has(third.group)) {
    return 'pending'
  }

  const knownBetter = completedThirds.filter(
    row => row.group !== third.group && strictlyBeatsThird(row, third),
  ).length

  let maxBeatersFromIncomplete = 0
  let minBeatersFromIncomplete = 0

  for (const letter of GROUP_LETTERS) {
    if (completed.has(letter)) continue
    const row = statsByGroup[letter]
    if (!row?.team) continue

    const maxStats = estimateMaxThirdStatsForGroup(letter, row, groupMatches, apiMatches)
    const minStats = estimateMinThirdStatsForGroup(letter, row, groupMatches, apiMatches)

    if (maxStats && strictlyBeatsThird(maxStats, third)) {
      maxBeatersFromIncomplete += 1
    }
    if (minStats && strictlyBeatsThird(minStats, third)) {
      minBeatersFromIncomplete += 1
    }
  }

  if (knownBetter + maxBeatersFromIncomplete < 8) return 'qualified'
  if (knownBetter + minBeatersFromIncomplete >= 8) return 'eliminated'
  return 'pending'
}

/**
 * Ranking provisional de los 12 terceros con stats conocidas.
 * @returns {ThirdPlaceStats[]}
 */
export function calculateThirdPlaceRanking(statsByGroup) {
  return GROUP_LETTERS.map(group => statsByGroup[group]).filter(Boolean).sort(compareThirdPlaceStats)
}

function buildStatsByGroup(fotmobStandings, allByGroup) {
  /** @type {Record<string, ThirdPlaceStats>} */
  const statsByGroup = {}
  const fromMap = fotmobStandings?.thirdStatsByGroup ?? {}

  for (const group of GROUP_LETTERS) {
    const row = fromMap[group]
    const team = allByGroup[group]?.[3] ?? row?.team ?? null
    if (!team && !row) continue
    statsByGroup[group] = {
      group,
      team: team ?? row.team,
      pts: row?.pts ?? 0,
      gd: row?.gd ?? 0,
      gf: row?.gf ?? 0,
      gc: row?.gc ?? 0,
      pj: row?.pj ?? row?.played ?? 0,
      fairPlay: row?.fairPlay ?? 0,
    }
  }

  return statsByGroup
}

/**
 * @param {string[]} qualifiedThirdGroups
 * @param {string[]} viableCombinationKeys
 * @returns {Array<{ group: string, matchNumber: number, opponentSource: string }>}
 */
export function resolveThirdPlaceBracketSlots(qualifiedThirdGroups, viableCombinationKeys) {
  /** @type {Array<{ group: string, matchNumber: number, opponentSource: string }>} */
  const resolved = []

  for (const group of qualifiedThirdGroups) {
    const matchNumbers = new Set()
    for (const key of viableCombinationKeys || []) {
      const assignments = thirdPlaceCombinationMap[key]
      if (!assignments) continue
      const matchNum = Object.entries(assignments).find(([, g]) => g === group)?.[0]
      if (matchNum != null) matchNumbers.add(Number(matchNum))
    }
    if (matchNumbers.size !== 1) continue

    const matchNumber = [...matchNumbers][0]
    const slot = roundOf32Map.find(row => row.match === matchNumber)
    if (!slot) continue

    const opponentSource = slot.home.includes('3') || /^3/.test(slot.home)
      ? slot.away
      : slot.home

    resolved.push({ group, matchNumber, opponentSource })
  }

  return resolved
}

/**
 * Contexto completo: ranking, estados matemáticos y slots resueltos.
 */
export function buildThirdPlaceQualificationContext(
  fotmobStandings,
  groupMatches = [],
  apiMatches = [],
  allByGroup = {},
) {
  const completed = getCompletedGroupLetters(apiMatches, groupMatches)
  const statsByGroup = buildStatsByGroup(fotmobStandings, allByGroup)
  const ranking = calculateThirdPlaceRanking(statsByGroup)
  const completedThirds = ranking.filter(row => completed.has(row.group))

  /** @type {Record<string, ThirdPlaceTeamState>} */
  const teamStates = {}

  for (const group of GROUP_LETTERS) {
    const stats = statsByGroup[group]
    const team = allByGroup[group]?.[3] ?? stats?.team ?? null
    if (!team) continue

    const qualificationStatus = stats
      ? calculateMathematicalQualificationStatus(
          stats,
          completedThirds,
          completed,
          statsByGroup,
          { groupMatches, apiMatches },
        )
      : 'pending'

    teamStates[group] = {
      team,
      group,
      groupPosition: 3,
      points: stats?.pts ?? 0,
      goalDifference: stats?.gd ?? 0,
      goalsFor: stats?.gf ?? 0,
      qualificationStatus,
      bracketSlotResolved: false,
    }
  }

  const qualifiedThirdGroups = GROUP_LETTERS.filter(
    g => teamStates[g]?.qualificationStatus === 'qualified',
  )

  const viableCombinationKeys = getViableThirdCombinationKeysFromQualified(
    qualifiedThirdGroups,
    completed,
  )

  const resolvedSlots = resolveThirdPlaceBracketSlots(qualifiedThirdGroups, viableCombinationKeys)

  for (const slot of resolvedSlots) {
    if (!teamStates[slot.group]) continue
    teamStates[slot.group].bracketSlotResolved = true
    teamStates[slot.group].resolvedMatchId = slot.matchNumber
    teamStates[slot.group].resolvedOpponent = slot.opponentSource
  }

  return {
    completed,
    statsByGroup,
    ranking,
    teamStates,
    qualifiedThirdGroups,
    viableCombinationKeys,
    resolvedSlots,
    allByGroup,
  }
}

export function getViableThirdCombinationKeysFromQualified(qualifiedThirdGroups, completed) {
  const keys = Object.keys(thirdPlaceCombinationMap)
  const lockedThirdGroups = (qualifiedThirdGroups || []).filter(g => completed.has(g))
  if (lockedThirdGroups.length === 0) return keys
  return keys.filter(key => lockedThirdGroups.every(g => key.includes(g)))
}

export function getQualificationStatus(group, ctx) {
  return ctx?.teamStates?.[group]?.qualificationStatus ?? 'pending'
}

export function isMathematicallyQualifiedThird(group, ctx) {
  return getQualificationStatus(group, ctx) === 'qualified'
}

export function isBracketSlotResolvedForTeamState(group, ctx) {
  return Boolean(ctx?.teamStates?.[group]?.bracketSlotResolved)
}

export function findTeamStateByTeamName(teamName, ctx) {
  if (!teamName) return null
  for (const state of Object.values(ctx?.teamStates ?? {})) {
    if (teamsMatch(state.team, teamName)) return state
  }
  return null
}
