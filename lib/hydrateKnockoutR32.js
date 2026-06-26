import {
  formatFifaMatchLabel,
  formatKnockoutMatchupLabel,
  normalizeTeamName,
  teamsMatch,
} from './fifaMatchNumbers.js'
import { formatFifaSlotCode } from './formatFifaSlot.js'
import { getCompletedGroupLetters } from './groupStageCompletion.js'
import {
  buildActualQualifiersFromFotmobStandings,
  buildTeamToGroupLetterMap,
  parseGroupSlotSource,
} from './groupQualificationScoring.js'
import { filterApiKnockoutR32 } from './knockoutBridge.js'
import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'
import { thirdPlaceCombinationMap } from './knockout/dist/config/thirdPlaceCombinationMap.js'
import { isResolvedTeamName } from './knockoutMatchScoring.js'
import { displayTeamName } from './teamNamesEs.js'

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

function resolveTeamGroup(teamName, teamToGroup) {
  const key = normalizeTeamName(teamName)
  if (!key) return null
  if (teamToGroup.has(key)) return teamToGroup.get(key)
  for (const [mapKey, letter] of teamToGroup.entries()) {
    if (teamsMatch(mapKey, teamName)) return letter
  }
  return null
}

function buildTeamCrestLookup(groupMatches = [], knockoutMatches = []) {
  const map = new Map()
  const add = (name, crest) => {
    if (!name || !crest || map.has(name)) return
    map.set(name, crest)
  }
  for (const m of groupMatches || []) {
    add(m.home, m.homeCrest)
    add(m.away, m.awayCrest)
  }
  for (const m of knockoutMatches || []) {
    add(m.home, m.homeCrest)
    add(m.away, m.awayCrest)
  }
  return {
    crestFor(name) {
      if (!name) return null
      if (map.has(name)) return map.get(name)
      for (const [key, crest] of map.entries()) {
        if (teamsMatch(key, name)) return crest
      }
      return null
    },
  }
}

/**
 * Asignación oficial FIFA (Anexo C) cuando hay 8 mejores terceros confirmados en FotMob.
 * @returns {Record<number, string>} matchNumber → grupo del tercero (p. ej. 81 → 'B')
 */
export function buildThirdPlaceAssignmentsFromFotmob(fotmobStandings, groupMatches = []) {
  const confirmed = (fotmobStandings?.bestThirds || []).filter(row => row.qualifies)
  if (confirmed.length !== 8) return {}

  const teamToGroup = buildTeamToGroupLetterMap(groupMatches)
  const byGroup = fotmobStandings?.byGroup ?? {}
  const groups = []

  for (const row of confirmed) {
    let letter = resolveTeamGroup(row.name, teamToGroup)
    if (!letter) {
      for (const [group, slots] of Object.entries(byGroup)) {
        if (slots?.[3] && teamsMatch(slots[3], row.name)) {
          letter = group
          break
        }
      }
    }
    if (!letter) return {}
    groups.push(letter)
  }

  const key = [...new Set(groups)].sort().join('')
  if (key.length !== 8) return {}

  return thirdPlaceCombinationMap[key] ?? {}
}

/** Asignaciones 3.º → partido según cruces API ya resueltos y válidos. */
export function inferThirdPlaceAssignmentsFromR32(r32Matches = [], groupMatches = [], byGroup = {}) {
  const teamToGroup = buildTeamToGroupLetterMap(groupMatches)
  const assignments = {}

  for (const m of r32Matches) {
    const matchNum = m.matchNumber
    if (!matchNum) continue
    for (const side of ['home', 'away']) {
      const source = side === 'home' ? m.homeSource : m.awaySource
      const parsed = parseGroupSlotSource(source)
      if (!parsed || parsed.position !== 3) continue
      const team = matchTeamName(m, side)
      if (!isResolvedTeamName(team)) continue
      const group = resolveTeamGroup(team, teamToGroup)
      if (!group || !parsed.groups.includes(group)) continue
      if (!byGroup[group]?.[3] || !teamsMatch(byGroup[group][3], team)) continue
      assignments[matchNum] = group
    }
  }

  return assignments
}

function resolveSlotTeamName(
  source,
  confirmedByGroup,
  allByGroup,
  completed,
  thirdAssignments,
  matchNumber,
) {
  const parsed = parseGroupSlotSource(source)
  if (!parsed) return null

  if (parsed.position === 3) {
    const assigned = thirdAssignments[matchNumber]
    if (!assigned || !parsed.groups.includes(assigned)) return null
    return allByGroup[assigned]?.[3] ?? null
  }

  const group = parsed.groups[0]
  if (!completed.has(group)) return null
  return confirmedByGroup[group]?.[parsed.position] ?? null
}

function resolveBracketSide(
  source,
  apiTeamName,
  confirmedByGroup,
  allByGroup,
  completed,
  thirdAssignments,
  matchNumber,
  teamToGroup,
) {
  const parsed = parseGroupSlotSource(source)
  const fromStandings = resolveSlotTeamName(
    source,
    confirmedByGroup,
    allByGroup,
    completed,
    thirdAssignments,
    matchNumber,
  )
  if (fromStandings) return fromStandings

  if (parsed?.position === 3) {
    return null
  }

  if (parsed && !completed.has(parsed.groups[0])) {
    return null
  }

  if (isResolvedTeamName(apiTeamName)) return apiTeamName
  return null
}

function crestForResolvedTeam(rawTeam, crestLookup) {
  if (!rawTeam) return null
  return crestLookup.crestFor(rawTeam) ?? null
}

/**
 * Rellena dieciseisavos (73–88) con clasificados FotMob en grupos ya cerrados.
 * Terceros: solo con tabla FIFA de combinaciones (8 mejores terceros confirmados).
 */
export function hydrateKnockoutR32FromStandings(
  apiKnockoutMatches = [],
  fotmobStandings = null,
  groupMatches = [],
  apiMatches = [],
) {
  const completed = getCompletedGroupLetters(apiMatches, groupMatches)
  const { byGroup: confirmedByGroup, ready } = buildActualQualifiersFromFotmobStandings(
    fotmobStandings,
    completed,
  )
  const allByGroup = fotmobStandings?.byGroup ?? confirmedByGroup
  const r32Api = filterApiKnockoutR32(apiKnockoutMatches)
  const apiByNum = Object.fromEntries(
    r32Api.filter(m => m.matchNumber != null).map(m => [m.matchNumber, m]),
  )
  const thirdAssignments = ready
    ? {
        ...buildThirdPlaceAssignmentsFromFotmob(fotmobStandings, groupMatches),
        ...inferThirdPlaceAssignmentsFromR32(r32Api, groupMatches, allByGroup),
      }
    : {}
  const teamToGroup = buildTeamToGroupLetterMap(groupMatches)
  const crestLookup = buildTeamCrestLookup(groupMatches, apiKnockoutMatches)

  return roundOf32Map.map(slot => {
    const api = apiByNum[slot.match]
    const homeSource = api?.homeSource ?? slot.home
    const awaySource = api?.awaySource ?? slot.away
    const rawHome = resolveBracketSide(
      homeSource,
      api?.home,
      confirmedByGroup,
      allByGroup,
      completed,
      thirdAssignments,
      slot.match,
      teamToGroup,
    )
    const rawAway = resolveBracketSide(
      awaySource,
      api?.away,
      confirmedByGroup,
      allByGroup,
      completed,
      thirdAssignments,
      slot.match,
      teamToGroup,
    )
    const home = rawHome ? displayTeamName(rawHome) : formatFifaSlotCode(homeSource)
    const away = rawAway ? displayTeamName(rawAway) : formatFifaSlotCode(awaySource)

    return {
      ...api,
      id: api?.id ?? `bracket-${slot.match}`,
      matchNumber: slot.match,
      fifaMatchLabel: formatFifaMatchLabel(slot.match),
      knockoutMatchupLabel: formatKnockoutMatchupLabel(homeSource, awaySource),
      homeSource,
      awaySource,
      home,
      away,
      homeCrest: crestForResolvedTeam(rawHome, crestLookup),
      awayCrest: crestForResolvedTeam(rawAway, crestLookup),
      venue: api?.venue ?? slot.venue,
      utcDate: api?.utcDate ?? slot.utcDate,
      roundId: 'r32',
      roundLabel: api?.roundLabel ?? 'Dieciseisavos',
      isPredictedBracket: false,
    }
  })
}

/** Partidos KO para En Vivo: dieciseisavos hidratados + resto de fases desde API. */
export function buildLiveKnockoutMatches(
  knockoutMatches = [],
  fotmobStandings = null,
  groupMatches = [],
  apiMatches = [],
) {
  const hydratedR32 = hydrateKnockoutR32FromStandings(
    knockoutMatches,
    fotmobStandings,
    groupMatches,
    apiMatches,
  )
  const r32Nums = new Set(hydratedR32.map(m => m.matchNumber))
  const rest = (knockoutMatches || []).filter(m => !r32Nums.has(m.matchNumber))
  return [...hydratedR32, ...rest].sort(
    (a, b) => (a.matchNumber ?? 999) - (b.matchNumber ?? 999) || new Date(a.utcDate) - new Date(b.utcDate),
  )
}
