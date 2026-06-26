import { teamsMatch, normalizeTeamName } from './fifaMatchNumbers.js'
import { computeGroupStandings } from './groupStandings.js'
import { isResolvedTeamName } from './knockoutMatchScoring.js'
import { filterApiKnockoutR32 } from './knockoutBridge.js'
import { standingsBlocksToGroupsInput, getQualifiedTeams } from './knockout/dist/index.js'
import {
  filterQualifiersByCompletedGroups,
  getCompletedGroupLetters,
  mergeCompletedGroupLetters,
} from './groupStageCompletion.js'
import { buildThirdPlaceQualificationContext } from './thirdPlaceQualification.js'

export const GROUP_LETTERS = /** @type {const} */ (
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
)

/** +1 si el equipo clasifica; +1 extra si aciertas 1.º / 2.º / 3.º (mejor tercero). */
export const QUALIFICATION_SCORING = {
  qualifies: 1,
  exactPosition: 1,
}

export function emptyGroupMap() {
  return Object.fromEntries(GROUP_LETTERS.map(g => [g, { 1: null, 2: null, 3: null }]))
}

function teamNameFromSide(side) {
  if (!side) return null
  if (typeof side === 'string') return side
  return side.name || side.shortName || null
}

function matchTeamName(m, side) {
  if (side === 'home') {
    return m.home ?? teamNameFromSide(m.homeTeam)
  }
  return m.away ?? teamNameFromSide(m.awayTeam)
}

/**
 * @param {string} source — 1A, 2B, 3A/B/C/D/F
 * @returns {{ position: 1|2|3, groups: string[] } | null}
 */
export function parseGroupSlotSource(source) {
  if (!source) return null
  const s = String(source).trim()
  const direct = /^([123])([A-L])$/.exec(s)
  if (direct) {
    return { position: Number(direct[1]), groups: [direct[2]] }
  }
  const third = /^3([A-L](?:\/[A-L])*)$/.exec(s)
  if (third) {
    return { position: 3, groups: third[1].split('/') }
  }
  return null
}

/** Grupo FIFA de cada selección (catálogo estático de fase de grupos). */
export function buildTeamToGroupLetterMap(groupMatches = []) {
  const map = new Map()
  for (const m of groupMatches || []) {
    const g = String(m.group || '').replace(/^GROUP_/i, '')
    if (!g) continue
    for (const side of [m.home, m.away, m.homeTeam, m.awayTeam]) {
      const name = teamNameFromSide(side)
      if (!name) continue
      const key = normalizeTeamName(name)
      if (key) map.set(key, g)
    }
  }
  return map
}

function resolveTeamGroup(teamName, teamToGroup) {
  const key = normalizeTeamName(teamName)
  if (!key) return null
  if (teamToGroup.has(key)) return teamToGroup.get(key)
  for (const [mapKey, letter] of teamToGroup.entries()) {
    if (teamsMatch(mapKey, teamName)) return letter
  }
  return null
}

/**
 * Clasificados reales desde tablas FotMob, limitados a grupos con todos los partidos finalizados.
 */
export function buildActualQualifiersFromFotmobStandings(
  fotmobStandings,
  completedGroups = null,
) {
  if (!fotmobStandings?.ready || !fotmobStandings.byGroup) {
    return {
      byGroup: emptyGroupMap(),
      resolvedCount: 0,
      ready: false,
      source: 'fotmob',
    }
  }
  const completed = completedGroups instanceof Set
    ? completedGroups
    : completedGroups != null
      ? new Set(completedGroups)
      : null
  const byGroup = completed
    ? filterQualifiersByCompletedGroups(fotmobStandings.byGroup, completed)
    : fotmobStandings.byGroup
  const resolvedCount = Object.values(byGroup).reduce((n, row) => {
    return n + (row[1] ? 1 : 0) + (row[2] ? 1 : 0) + (row[3] ? 1 : 0)
  }, 0)
  return {
    byGroup,
    resolvedCount,
    ready: resolvedCount > 0,
    source: 'fotmob',
  }
}

/**
 * Respaldo: clasificados reales según dieciseisavos (plazas 1A, 2B, 3… en homeSource/awaySource).
 */
export function buildActualQualifiersFromApiR32(
  apiKnockoutMatches = [],
  groupMatches = [],
  completedGroups = null,
) {
  const byGroup = emptyGroupMap()
  const teamToGroup = buildTeamToGroupLetterMap(groupMatches)
  const completed = completedGroups == null
    ? new Set(GROUP_LETTERS)
    : completedGroups instanceof Set
      ? completedGroups
      : new Set(completedGroups)
  const r32 = filterApiKnockoutR32(apiKnockoutMatches)
  let resolved = 0

  for (const m of r32) {
    const sides = [
      { team: matchTeamName(m, 'home'), source: m.homeSource },
      { team: matchTeamName(m, 'away'), source: m.awaySource },
    ]
    for (const { team, source } of sides) {
      if (!isResolvedTeamName(team)) continue
      const parsed = parseGroupSlotSource(source)
      if (!parsed) continue

      if (parsed.position === 3) {
        const group = resolveTeamGroup(team, teamToGroup)
        if (!group || !parsed.groups.includes(group)) continue
        if (!completed.has(group)) continue
        if (!byGroup[group][3]) {
          byGroup[group][3] = team
          resolved += 1
        }
        continue
      }

      const group = parsed.groups[0]
      if (!GROUP_LETTERS.includes(group)) continue
      if (!completed.has(group)) continue
      if (!byGroup[group][parsed.position]) {
        byGroup[group][parsed.position] = team
        resolved += 1
      }
    }
  }

  return {
    byGroup,
    resolvedCount: resolved,
    ready: resolved > 0,
    source: 'r32',
  }
}

function resolveActualQualifiers({
  fotmobStandings,
  knockoutMatches,
  groupMatches,
  apiMatches = [],
}) {
  const completed = getCompletedGroupLetters(apiMatches, groupMatches)
  const fromFotmob = buildActualQualifiersFromFotmobStandings(fotmobStandings, completed)
  if (fromFotmob.ready) return fromFotmob

  const hasLiveMatches = (apiMatches || []).some(m => /^\d+$/.test(String(m.id)))
  if (hasLiveMatches) {
    return {
      byGroup: emptyGroupMap(),
      resolvedCount: 0,
      ready: false,
      source: 'fotmob',
    }
  }

  return buildActualQualifiersFromApiR32(knockoutMatches, groupMatches, completed)
}

function buildActualByGroupFromStandings(groupMatches = [], groupResults = {}, completedGroups) {
  const completed = completedGroups instanceof Set ? completedGroups : new Set(completedGroups || [])
  const scoresMap = {}
  for (const [id, r] of Object.entries(groupResults || {})) {
    if (r?.home != null && r?.away != null) scoresMap[id] = r
  }
  const blocks = computeGroupStandings(groupMatches, scoresMap)
  const byGroup = emptyGroupMap()

  for (const block of blocks) {
    const letter = String(block.letter ?? block.id ?? '').replace(/^GROUP_/i, '').toUpperCase()
    if (!letter || !completed.has(letter)) continue
    const ordered = block.teams || []
    if (ordered[0]?.name) byGroup[letter][1] = ordered[0].name
    if (ordered[1]?.name) byGroup[letter][2] = ordered[1].name
    if (ordered[2]?.name) byGroup[letter][3] = ordered[2].name
  }

  const resolvedCount = Object.values(byGroup).reduce((n, row) => {
    return n + (row[1] ? 1 : 0) + (row[2] ? 1 : 0) + (row[3] ? 1 : 0)
  }, 0)

  return {
    byGroup,
    resolvedCount,
    ready: resolvedCount > 0,
    source: 'standings',
  }
}

function teamMatchesQualificationSlot(team, slotTeam) {
  return slotTeam && teamsMatch(slotTeam, team)
}

function teamFailedGroupQualification(team, letter, actualByGroup, thirdCtx) {
  const row = actualByGroup[letter] || {}
  if (teamMatchesQualificationSlot(team, row[1])) return false
  if (teamMatchesQualificationSlot(team, row[2])) return false
  if (teamMatchesQualificationSlot(team, row[3])) {
    const status = thirdCtx?.teamStates?.[letter]?.qualificationStatus ?? 'pending'
    return status === 'eliminated'
  }
  return true
}

/**
 * Equipos que no clasificaron a dieciseisavos (últimos del grupo o tercero eliminado).
 * Solo aplica cuando su grupo ya terminó.
 */
export function buildNonQualifiedTeamsFromGroups({
  groupMatches = [],
  knockoutMatches = [],
  fotmobStandings = null,
  apiMatches = [],
  groupResults = {},
} = {}) {
  const completed = mergeCompletedGroupLetters(apiMatches, groupMatches, groupResults)
  if (!completed.size) return new Set()

  let actual = resolveActualQualifiers({
    fotmobStandings,
    knockoutMatches,
    groupMatches,
    apiMatches,
  })

  if (!actual.ready) {
    actual = buildActualByGroupFromStandings(groupMatches, groupResults, completed)
  }
  if (!actual.ready) return new Set()

  const thirdCtx = buildThirdPlaceQualificationContext(
    fotmobStandings,
    groupMatches,
    apiMatches,
    actual.byGroup,
  )

  const nonQualified = new Set()
  const teamToGroup = buildTeamToGroupLetterMap(groupMatches)

  for (const [nt, letter] of teamToGroup) {
    if (!completed.has(letter)) continue
    if (teamFailedGroupQualification(nt, letter, actual.byGroup, thirdCtx)) {
      nonQualified.add(nt)
    }
  }

  return nonQualified
}

/**
 * Clasificados previstos según marcadores de grupos (1.º, 2.º y mejores terceros).
 */
export function buildPredictedQualifiersFromGroupPreds(groupMatches = [], groupPreds = {}) {
  const blocks = computeGroupStandings(groupMatches, groupPreds)
  if (blocks.length < 12) {
    return { byGroup: emptyGroupMap(), complete: false }
  }

  const groups = standingsBlocksToGroupsInput(blocks)
  const q = getQualifiedTeams(groups)
  const byGroup = emptyGroupMap()

  for (const e of q.winners) byGroup[e.group][1] = e.team.name
  for (const e of q.runnersUp) byGroup[e.group][2] = e.team.name
  for (const e of q.bestThirdPlaced) byGroup[e.group][3] = e.team.name

  return { byGroup, complete: true }
}

function groupHasActual(actualRow) {
  return !!(actualRow?.[1] || actualRow?.[2] || actualRow?.[3])
}

/**
 * @returns {{ total: number, qualifies: number, exactPosition: number, slots: object[] }}
 */
export function calcQualificationPointsSplit(predictedByGroup, actualByGroup) {
  let qualifies = 0
  let exactPosition = 0
  const slots = []

  for (const letter of GROUP_LETTERS) {
    const pred = predictedByGroup[letter] || {}
    const actual = actualByGroup[letter] || {}
    if (!groupHasActual(actual)) continue

    const predictedSlots = /** @type {[1|2|3, string][]} */ (
      [1, 2, 3]
        .map(pos => [pos, pred[pos]])
        .filter(([, team]) => team)
    )

    const actualSlots = /** @type {[1|2|3, string][]} */ (
      [1, 2, 3]
        .map(pos => [pos, actual[pos]])
        .filter(([, team]) => team)
    )

    for (const [predPos, predTeam] of predictedSlots) {
      const hit = actualSlots.find(([, actualTeam]) => teamsMatch(predTeam, actualTeam))
      if (!hit) continue
      qualifies += QUALIFICATION_SCORING.qualifies
      const exact = hit[0] === predPos
      if (exact) exactPosition += QUALIFICATION_SCORING.exactPosition
      slots.push({
        group: letter,
        team: predTeam,
        predictedPosition: predPos,
        actualPosition: hit[0],
        qualifiesPts: QUALIFICATION_SCORING.qualifies,
        exactPts: exact ? QUALIFICATION_SCORING.exactPosition : 0,
      })
    }
  }

  return {
    total: qualifies + exactPosition,
    qualifies,
    exactPosition,
    slots,
  }
}

export function calcGroupQualificationPoints(
  participant,
  { groupMatches = [], knockoutMatches = [], fotmobStandings = null, apiMatches = [] } = {},
) {
  const preds = participant?.predictions || {}
  const predicted = buildPredictedQualifiersFromGroupPreds(groupMatches, preds.group || {})
  const actual = resolveActualQualifiers({
    fotmobStandings,
    knockoutMatches,
    groupMatches,
    apiMatches,
  })

  if (!predicted.complete || !actual.ready) {
    return {
      total: 0,
      qualifies: 0,
      exactPosition: 0,
      slots: [],
      ready: false,
      resolvedCount: actual.resolvedCount,
      actualSource: actual.source,
    }
  }

  const split = calcQualificationPointsSplit(predicted.byGroup, actual.byGroup)
  return {
    ...split,
    ready: true,
    resolvedCount: actual.resolvedCount,
    actualSource: actual.source,
  }
}

/** Puntos por equipo (clave = normalizeTeamName) para mostrar en tablas de clasificación. */
export function buildQualificationPointsByTeam(
  participant,
  { groupMatches = [], knockoutMatches = [], fotmobStandings = null, apiMatches = [] } = {},
) {
  const result = calcGroupQualificationPoints(participant, {
    groupMatches,
    knockoutMatches,
    fotmobStandings,
    apiMatches,
  })
  const byTeam = new Map()
  if (!result.ready) {
    return { byTeam, ready: false, resolvedCount: result.resolvedCount ?? 0 }
  }
  for (const slot of result.slots) {
    const key = normalizeTeamName(slot.team)
    if (!key) continue
    byTeam.set(key, {
      total: slot.qualifiesPts + slot.exactPts,
      qualifiesPts: slot.qualifiesPts,
      exactPts: slot.exactPts,
      predictedPosition: slot.predictedPosition,
      actualPosition: slot.actualPosition,
      group: slot.group,
    })
  }
  return { byTeam, ready: true, resolvedCount: result.resolvedCount }
}

export function lookupQualificationPoints(byTeam, teamName) {
  if (!byTeam || !teamName) return null
  return byTeam.get(normalizeTeamName(teamName)) ?? null
}
