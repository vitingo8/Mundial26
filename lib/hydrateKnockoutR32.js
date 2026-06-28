import {
  formatFifaMatchLabel,
  formatKnockoutMatchupLabel,
  normalizeTeamName,
  teamsMatch,
} from './fifaMatchNumbers.js'
import { formatFifaSlotCode } from './formatFifaSlot.js'
import { getCompletedGroupLetters } from './groupStageCompletion.js'
import { buildBracketQualifiersFromStandings } from './groupPositionLock.js'
import {
  buildActualQualifiersFromFotmobStandings,
  buildTeamToGroupLetterMap,
  parseGroupSlotSource,
} from './groupQualificationScoring.js'
import { filterApiKnockoutR32 } from './knockoutBridge.js'
import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'
import { thirdPlaceCombinationMap } from './knockout/dist/config/thirdPlaceCombinationMap.js'
import { isResolvedTeamName } from './knockoutMatchScoring.js'
import {
  buildQualifiedThirdsPendingList,
  buildThirdPlaceQualificationContext,
  buildThirdsPendingQualificationList,
  getViableThirdCombinationKeys,
  isCombinationFullyLocked,
  isThirdPlaceSlotSource,
  resolveThirdSideDisplay,
} from './knockoutThirdSlots.js'
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

function canonicalTeamPair(home, away) {
  const a = normalizeTeamName(home)
  const b = normalizeTeamName(away)
  if (!a || !b) return null
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function findR32ApiMatchByTeams(r32Api, home, away) {
  if (!home || !away) return null
  return r32Api.find(
    m =>
      isResolvedTeamName(m.home) &&
      isResolvedTeamName(m.away) &&
      teamsMatch(m.home, home) &&
      teamsMatch(m.away, away),
  )
}

function isKnockoutR32Stage(m) {
  return m?.roundId === 'r32' || m?.stage === 'LAST_32'
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
  bracketByGroup,
  thirdCtx,
  matchNumber,
) {
  const parsed = parseGroupSlotSource(source)
  if (!parsed) return null

  if (parsed.position === 3) {
    const third = resolveThirdSideDisplay(source, matchNumber, thirdCtx)
    return third.bracketSlotResolved ? third.team : null
  }

  const group = parsed.groups[0]
  return bracketByGroup[group]?.[parsed.position] ?? null
}

function resolveBracketSide(
  source,
  apiTeamName,
  bracketByGroup,
  completed,
  thirdCtx,
  matchNumber,
) {
  const parsed = parseGroupSlotSource(source)
  const fromStandings = resolveSlotTeamName(
    source,
    bracketByGroup,
    thirdCtx,
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

function buildSideDisplay(source, rawTeam, thirdDisplay, crestLookup) {
  if (thirdDisplay.isThird && thirdDisplay.pending) {
    const slotLabel = thirdDisplay.slotLabel || formatFifaSlotCode(source)
    return {
      label: slotLabel,
      crest: null,
      pendingThird: true,
      pendingThirdSlot: slotLabel,
      thirdQualified: thirdDisplay.qualified,
      thirdBracketResolved: false,
    }
  }
  if (rawTeam) {
    return {
      label: displayTeamName(rawTeam),
      crest: crestLookup.crestFor(rawTeam) ?? null,
      pendingThird: false,
      pendingThirdSlot: null,
      thirdQualified: Boolean(thirdDisplay.isThird && thirdDisplay.qualified),
      thirdBracketResolved: Boolean(thirdDisplay.bracketSlotResolved),
    }
  }
  return {
    label: formatFifaSlotCode(source),
    crest: null,
    pendingThird: false,
    pendingThirdSlot: null,
  }
}

/**
 * Rellena dieciseisavos (73–88) con clasificados FotMob en grupos ya cerrados.
 * Mejores terceros: nombre si el slot está resuelto; si no, código FIFA (3A/B/C…) y partido bloqueado.
 */
export function hydrateKnockoutR32FromStandings(
  apiKnockoutMatches = [],
  fotmobStandings = null,
  groupMatches = [],
  apiMatches = [],
) {
  const completed = getCompletedGroupLetters(apiMatches, groupMatches)
  const rawByGroup = fotmobStandings?.byGroup ?? {}
  const bracketByGroup = buildBracketQualifiersFromStandings(
    rawByGroup,
    completed,
    groupMatches,
    apiMatches,
  )
  const { ready } = buildActualQualifiersFromFotmobStandings(fotmobStandings, completed)
  const allByGroup = rawByGroup
  const bestThirds = fotmobStandings?.bestThirds ?? []
  const qualificationCtx = buildThirdPlaceQualificationContext(
    fotmobStandings,
    groupMatches,
    apiMatches,
    allByGroup,
  )
  const r32Api = filterApiKnockoutR32(apiKnockoutMatches)
  const apiByNum = Object.fromEntries(
    r32Api.filter(m => m.matchNumber != null).map(m => [m.matchNumber, m]),
  )
  const thirdAssignments = ready && isCombinationFullyLocked({ completed, bestThirds, allByGroup })
    ? {
        ...buildThirdPlaceAssignmentsFromFotmob(fotmobStandings, groupMatches),
        ...inferThirdPlaceAssignmentsFromR32(r32Api, groupMatches, allByGroup),
      }
    : inferThirdPlaceAssignmentsFromR32(r32Api, groupMatches, allByGroup)
  const thirdCtx = {
    completed,
    bestThirds,
    allByGroup,
    thirdAssignments,
    ...qualificationCtx,
  }
  const crestLookup = buildTeamCrestLookup(groupMatches, apiKnockoutMatches)

  return roundOf32Map.map(slot => {
    let api = apiByNum[slot.match]
    const homeSource = api?.homeSource ?? slot.home
    const awaySource = api?.awaySource ?? slot.away
    const homeThird = isThirdPlaceSlotSource(homeSource)
      ? resolveThirdSideDisplay(homeSource, slot.match, thirdCtx)
      : null
    const awayThird = isThirdPlaceSlotSource(awaySource)
      ? resolveThirdSideDisplay(awaySource, slot.match, thirdCtx)
      : null
    const rawHome = resolveBracketSide(
      homeSource,
      api?.home,
      bracketByGroup,
      completed,
      thirdCtx,
      slot.match,
    )
    const rawAway = resolveBracketSide(
      awaySource,
      api?.away,
      bracketByGroup,
      completed,
      thirdCtx,
      slot.match,
    )
    if (rawHome && rawAway) {
      const teamMatch = findR32ApiMatchByTeams(r32Api, rawHome, rawAway)
      if (teamMatch) {
        api = teamMatch
      } else if (
        api &&
        !(teamsMatch(api.home, rawHome) && teamsMatch(api.away, rawAway))
      ) {
        api = { ...api, id: undefined, home: undefined, away: undefined }
      }
    }
    const homeSide = buildSideDisplay(
      homeSource,
      rawHome,
      homeThird ?? {
        isThird: false,
        pending: false,
        slotLabel: formatFifaSlotCode(homeSource),
        qualifiedPendingTeams: [],
      },
      crestLookup,
    )
    const awaySide = buildSideDisplay(
      awaySource,
      rawAway,
      awayThird ?? {
        isThird: false,
        pending: false,
        slotLabel: formatFifaSlotCode(awaySource),
        qualifiedPendingTeams: [],
      },
      crestLookup,
    )
    const homePendingThird = Boolean(homeThird?.isThird && homeThird.pending)
    const awayPendingThird = Boolean(awayThird?.isThird && awayThird.pending)
    const pendingThirdMatch = homePendingThird || awayPendingThird

    return {
      ...api,
      id: api?.id ?? `bracket-${slot.match}`,
      matchNumber: slot.match,
      fifaMatchLabel: formatFifaMatchLabel(slot.match),
      knockoutMatchupLabel: formatKnockoutMatchupLabel(homeSource, awaySource),
      homeSource,
      awaySource,
      home: homeSide.label,
      away: awaySide.label,
      homeCrest: homeSide.crest,
      awayCrest: awaySide.crest,
      homePendingThird,
      awayPendingThird,
      pendingThirdMatch,
      homePendingThirdSlot: homeSide.pendingThirdSlot,
      awayPendingThirdSlot: awaySide.pendingThirdSlot,
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
  const hydratedPairs = new Set()
  for (const m of hydratedR32) {
    if (isResolvedTeamName(m.home) && isResolvedTeamName(m.away)) {
      const pair = canonicalTeamPair(m.home, m.away)
      if (pair) hydratedPairs.add(pair)
    }
  }
  const rest = (knockoutMatches || []).filter(m => {
    if (r32Nums.has(m.matchNumber)) return false
    if (isKnockoutR32Stage(m)) {
      if (isResolvedTeamName(m.home) && isResolvedTeamName(m.away)) {
        const pair = canonicalTeamPair(m.home, m.away)
        if (pair && hydratedPairs.has(pair)) return false
      }
    }
    return true
  })
  return [...hydratedR32, ...rest].sort(
    (a, b) => (a.matchNumber ?? 999) - (b.matchNumber ?? 999) || new Date(a.utcDate) - new Date(b.utcDate),
  )
}

export { isKnockoutMatchPendingThird, buildQualifiedThirdsPendingList, buildThirdsPendingQualificationList } from './knockoutThirdSlots.js'

export function buildKnockoutThirdPlacementContext(
  fotmobStandings,
  groupMatches = [],
  apiMatches = [],
) {
  const allByGroup = fotmobStandings?.byGroup ?? {}
  const qualificationCtx = buildThirdPlaceQualificationContext(
    fotmobStandings,
    groupMatches,
    apiMatches,
    allByGroup,
  )
  const ctx = { ...qualificationCtx, bestThirds: fotmobStandings?.bestThirds ?? [], allByGroup }
  return {
    ...ctx,
    qualifiedThirdsPending: buildQualifiedThirdsPendingList(ctx),
    thirdsPendingQualification: buildThirdsPendingQualificationList(ctx),
    combinationFullyLocked: isCombinationFullyLocked(ctx),
    viableCombinationCount: ctx.viableCombinationKeys.length,
  }
}
