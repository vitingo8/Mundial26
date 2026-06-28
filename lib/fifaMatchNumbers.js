import groupStageCatalog from './fifaMatchCatalog/groupStage.json' with { type: 'json' }
import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'
import { KNOCKOUT_BRACKET_TREE } from './knockoutBracketTree.js'
import { matchFingerprint } from './matchIdMap.js'
import { formatFifaSlotCode, formatKnockoutMatchupLabel } from './formatFifaSlot.js'
import { toCanonicalTeamName } from './teamNamesEs.js'
import { GROUPS_DATA_2026 } from './groups2026.js'
import { parseGroupSlotSource } from './groupQualificationScoring.js'
import { isResolvedTeamName } from './resolvedTeamName.js'

export const FIFA_MATCH_COUNT = 104

export function normalizeTeamName(name) {
  if (!name) return ''
  return toCanonicalTeamName(name)
}

export function teamsMatch(a, b) {
  const na = normalizeTeamName(a)
  const nb = normalizeTeamName(b)
  if (!na || !nb) return false
  return na === nb
}

export function formatFifaMatchLabel(matchNumber) {
  if (matchNumber == null || Number.isNaN(Number(matchNumber))) return null
  return `Partido ${matchNumber}`
}

function extractFields(m) {
  const groupRaw = m.group || ''
  const group = String(groupRaw).replace(/^GROUP_/i, '')
  const home =
    m.home ||
    m.homeTeam?.shortName ||
    m.homeTeam?.name ||
    ''
  const away =
    m.away ||
    m.awayTeam?.shortName ||
    m.awayTeam?.name ||
    ''
  return {
    group,
    home,
    away,
    utcDate: m.utcDate,
    stage: m.stage,
    venue: m.venue,
    matchNumber: m.matchNumber,
  }
}

function sameUtcDay(a, b) {
  if (!a || !b) return false
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10)
}

const staticTeamToGroup = (() => {
  const map = new Map()
  for (const [letter, teams] of Object.entries(GROUPS_DATA_2026)) {
    for (const team of teams) {
      const key = normalizeTeamName(team)
      if (key) map.set(key, letter)
    }
  }
  return map
})()

function resolveTeamGroupLetter(teamName, teamToGroup = staticTeamToGroup) {
  const key = normalizeTeamName(teamName)
  if (!key) return null
  if (teamToGroup.has(key)) return teamToGroup.get(key)
  for (const [mapKey, letter] of teamToGroup.entries()) {
    if (teamsMatch(mapKey, teamName)) return letter
  }
  return null
}

function matchesSingleGroupPosition(source, group, position) {
  const parsed = parseGroupSlotSource(source)
  return (
    parsed &&
    parsed.position === position &&
    parsed.groups.length === 1 &&
    parsed.groups[0] === group
  )
}

function matchesThirdGroupList(source, group) {
  const parsed = parseGroupSlotSource(source)
  return (
    parsed &&
    parsed.position === 3 &&
    parsed.groups.length > 1 &&
    parsed.groups.includes(group)
  )
}

function resolveR32MatchNumberByTeams(home, away) {
  if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) return null
  if (String(home).includes('/') || String(away).includes('/')) return null

  const homeGroup = resolveTeamGroupLetter(home)
  const awayGroup = resolveTeamGroupLetter(away)
  if (!homeGroup || !awayGroup) return null

  const fits = (slot, hGroup, aGroup) => {
    if (
      matchesSingleGroupPosition(slot.home, hGroup, 1) &&
      matchesThirdGroupList(slot.away, aGroup)
    ) {
      return true
    }
    if (
      matchesSingleGroupPosition(slot.home, hGroup, 1) &&
      matchesSingleGroupPosition(slot.away, aGroup, 2)
    ) {
      return true
    }
    if (
      matchesSingleGroupPosition(slot.home, hGroup, 2) &&
      matchesSingleGroupPosition(slot.away, aGroup, 1)
    ) {
      return true
    }
    if (
      matchesSingleGroupPosition(slot.home, hGroup, 2) &&
      matchesSingleGroupPosition(slot.away, aGroup, 2)
    ) {
      return true
    }
    if (
      matchesThirdGroupList(slot.home, hGroup) &&
      matchesSingleGroupPosition(slot.away, aGroup, 1)
    ) {
      return true
    }
    if (
      matchesThirdGroupList(slot.home, hGroup) &&
      matchesSingleGroupPosition(slot.away, aGroup, 2)
    ) {
      return true
    }
    return false
  }

  const direct = roundOf32Map.filter(slot => fits(slot, homeGroup, awayGroup))
  if (direct.length > 1) {
    const oneVsThird = direct.filter(
      slot =>
        (matchesSingleGroupPosition(slot.home, homeGroup, 1) &&
          matchesThirdGroupList(slot.away, awayGroup)) ||
        (matchesThirdGroupList(slot.home, homeGroup) &&
          matchesSingleGroupPosition(slot.away, awayGroup, 1)),
    )
    if (oneVsThird.length === 1) return oneVsThird[0].match
  }
  if (direct.length === 1) return direct[0].match

  return null
}

/** Catálogo unificado 73–104 (dieciseisavos → final). */
export function getKnockoutFifaCatalog() {
  const r32 = roundOf32Map.map(slot => ({
    n: slot.match,
    utcDate: slot.utcDate,
    venue: slot.venue,
    homeSource: slot.home,
    awaySource: slot.away,
    stage: 'LAST_32',
  }))
  const rest = KNOCKOUT_BRACKET_TREE.map(slot => ({
    n: slot.match,
    utcDate: slot.utcDate,
    venue: slot.venue,
    homeSource: slot.home,
    awaySource: slot.away,
    stage: slot.roundId === 'r16'
      ? 'LAST_16'
      : slot.roundId === 'qf'
        ? 'QUARTER_FINALS'
        : slot.roundId === 'sf'
          ? 'SEMI_FINALS'
          : slot.roundId === '3rd'
            ? 'THIRD_PLACE'
            : slot.roundId === 'final'
              ? 'FINAL'
              : 'LAST_16',
  }))
  return [...r32, ...rest]
}

const groupByTeams = new Map()
for (const row of groupStageCatalog) {
  const key = `${row.g}|${normalizeTeamName(row.home)}|${normalizeTeamName(row.away)}`
  groupByTeams.set(key, row.n)
}

const knockoutByNumber = new Map(getKnockoutFifaCatalog().map(r => [r.n, r]))
const knockoutByDate = getKnockoutFifaCatalog()

/**
 * Resuelve el número FIFA oficial (1–104) para un partido API o transformado.
 */
export function resolveFifaMatchNumber(m) {
  if (m.matchNumber != null && m.matchNumber >= 1 && m.matchNumber <= FIFA_MATCH_COUNT) {
    return m.matchNumber
  }

  const { group, home, away, utcDate, stage } = extractFields(m)

  if (stage === 'GROUP_STAGE' || (!stage && group)) {
    const key = `${group}|${normalizeTeamName(home)}|${normalizeTeamName(away)}`
    const hit = groupByTeams.get(key)
    if (hit) return hit
    return null
  }

  if (stage === 'LAST_32') {
    const byTeams = resolveR32MatchNumberByTeams(home, away)
    if (byTeams != null) return byTeams
  }

  if (stage && stage !== 'GROUP_STAGE') {
    const stageMatches = knockoutByDate.filter(r => {
      const stageOk =
        (stage === 'LAST_32' && r.n >= 73 && r.n <= 88) ||
        (stage === 'LAST_16' && r.n >= 89 && r.n <= 96) ||
        (stage === 'QUARTER_FINALS' && r.n >= 97 && r.n <= 100) ||
        (stage === 'SEMI_FINALS' && r.n >= 101 && r.n <= 102) ||
        (stage === 'THIRD_PLACE' && r.n === 103) ||
        (stage === 'FINAL' && r.n === 104)
      return stageOk && sameUtcDay(r.utcDate, utcDate)
    })
    if (stageMatches.length === 1) return stageMatches[0].n
    if (stageMatches.length > 1 && utcDate) {
      const t = new Date(utcDate).getTime()
      stageMatches.sort(
        (a, b) =>
          Math.abs(new Date(a.utcDate).getTime() - t) -
          Math.abs(new Date(b.utcDate).getTime() - t),
      )
      return stageMatches[0].n
    }
  }

  if (utcDate) {
    const dayHits = knockoutByDate.filter(r => sameUtcDay(r.utcDate, utcDate))
    if (dayHits.length === 1) return dayHits[0].n
  }

  return null
}

export function enrichMatch(m) {
  const matchNumber = resolveFifaMatchNumber(m)
  const catalogSlot =
    matchNumber != null
      ? matchNumber <= 72
        ? groupStageCatalog.find(r => r.n === matchNumber)
        : knockoutByNumber.get(matchNumber)
      : null

  const homeSource = m.homeSource ?? catalogSlot?.homeSource
  const awaySource = m.awaySource ?? catalogSlot?.awaySource
  const homeSlotLabel = homeSource ? formatFifaSlotCode(homeSource) : undefined
  const awaySlotLabel = awaySource ? formatFifaSlotCode(awaySource) : undefined
  const knockoutMatchupLabel = formatKnockoutMatchupLabel(homeSource, awaySource)

  return {
    ...m,
    matchNumber: matchNumber ?? undefined,
    fifaMatchLabel: formatFifaMatchLabel(matchNumber),
    homeSource,
    awaySource,
    homeSlotLabel,
    awaySlotLabel,
    knockoutMatchupLabel,
    _fp: m._fp || matchFingerprint(extractFields(m)),
  }
}

export { formatFifaSlotCode, formatKnockoutMatchupLabel } from './formatFifaSlot.js'

/** Enriquece partidos crudos de football-data.org */
export function enrichApiMatches(apiMatches) {
  return (apiMatches || []).map(enrichMatch)
}

/** Índice matchNumber → id API (cuando hay partidos enriquecidos). */
export function buildMatchNumberToIdMap(matches) {
  const out = {}
  for (const m of matches || []) {
    if (m.matchNumber != null && m.id) out[m.matchNumber] = String(m.id)
  }
  return out
}
