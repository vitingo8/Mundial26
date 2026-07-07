import groupStageCatalog from './fifaMatchCatalog/groupStage.json' with { type: 'json' }
import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'
import { KNOCKOUT_BRACKET_TREE } from './knockoutBracketTree.js'
import { matchFingerprint } from './matchIdMap.js'
import { formatFifaSlotCode, formatKnockoutMatchupLabel } from './formatFifaSlot.js'
import { toCanonicalTeamName } from './teamNamesEs.js'
import { GROUPS_DATA_2026 } from './groups2026.js'
import { parseGroupSlotSource } from './groupQualificationScoring.js'
import { isResolvedTeamName } from './resolvedTeamName.js'
import { computeGroupStandings } from './groupStandings.js'

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

function normalizeVenue(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function sameVenue(a, b) {
  const na = normalizeVenue(a)
  const nb = normalizeVenue(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
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

/** Grupo FIFA de cada selección: plantilla + catálogo de grupos + partidos GROUP_STAGE de la API. */
function buildTeamToGroupMap(allMatches) {
  const map = new Map(staticTeamToGroup)
  for (const row of groupStageCatalog) {
    const g = row.g
    const hk = normalizeTeamName(row.home)
    const ak = normalizeTeamName(row.away)
    if (hk) map.set(hk, g)
    if (ak) map.set(ak, g)
  }
  for (const m of allMatches || []) {
    if (m.stage !== 'GROUP_STAGE') continue
    const g = String(m.group || '').replace(/^GROUP_/i, '')
    if (!g) continue
    for (const name of [
      m.home,
      m.away,
      m.homeTeam?.shortName,
      m.homeTeam?.name,
      m.awayTeam?.shortName,
      m.awayTeam?.name,
    ]) {
      const key = normalizeTeamName(name)
      if (key) map.set(key, g)
    }
  }
  return map
}

/** Posición final (1–4) por equipo según resultados de grupos ya jugados en la API. */
function buildTeamPositionsFromGroupStage(allMatches) {
  const groupMatches = []
  const scoresMap = {}
  for (const m of allMatches || []) {
    if (m.stage !== 'GROUP_STAGE') continue
    const g = String(m.group || '').replace(/^GROUP_/i, '')
    if (!g) continue
    const home = m.home || m.homeTeam?.shortName || m.homeTeam?.name || ''
    const away = m.away || m.awayTeam?.shortName || m.awayTeam?.name || ''
    if (!home || !away) continue
    const id = String(m.id)
    groupMatches.push({ id, group: g, home, away })
    if (m.status === 'FINISHED' && m.score?.fullTime?.home != null && m.score?.fullTime?.away != null) {
      scoresMap[id] = m.score.fullTime
    }
  }
  if (!groupMatches.length) return null
  const blocks = computeGroupStandings(groupMatches, scoresMap)
  const positions = new Map()
  for (const block of blocks) {
    block.teams.forEach((team, idx) => {
      const key = normalizeTeamName(team.name)
      if (key) positions.set(key, idx + 1)
    })
  }
  return positions.size ? positions : null
}

function teamFitsSlotSource(teamName, source, teamToGroup, teamPositions) {
  const parsed = parseGroupSlotSource(source)
  if (!parsed) return false
  const group = resolveTeamGroupLetter(teamName, teamToGroup)
  if (!group) return false

  if (parsed.position === 3 && parsed.groups.length > 1) {
    if (!parsed.groups.includes(group)) return false
    if (teamPositions) {
      const pos = teamPositions.get(normalizeTeamName(teamName))
      return pos === 3
    }
    return true
  }

  if (parsed.groups.length === 1 && parsed.groups[0] === group) {
    if (teamPositions) {
      const pos = teamPositions.get(normalizeTeamName(teamName))
      return pos === parsed.position
    }
    return true
  }
  return false
}

function fitsR32Slot(slot, home, away, teamToGroup, teamPositions) {
  return (
    teamFitsSlotSource(home, slot.home, teamToGroup, teamPositions)
    && teamFitsSlotSource(away, slot.away, teamToGroup, teamPositions)
  )
}

function disambiguateCatalogSlots(candidates, m) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]

  const { utcDate, venue } = extractFields(m)
  if (venue) {
    const byVenue = candidates.filter(s => sameVenue(s.venue, venue))
    if (byVenue.length === 1) return byVenue[0]
  }
  if (utcDate) {
    const t = new Date(utcDate).getTime()
    const sorted = [...candidates].sort(
      (a, b) =>
        Math.abs(new Date(a.utcDate).getTime() - t) -
        Math.abs(new Date(b.utcDate).getTime() - t),
    )
    const best = Math.abs(new Date(sorted[0].utcDate).getTime() - t)
    const second = Math.abs(new Date(sorted[1].utcDate).getTime() - t)
    if (best < second) return sorted[0]
  }
  return null
}

function resolveR32MatchNumberByTeams(home, away, options = {}) {
  if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) return null
  if (String(home).includes('/') || String(away).includes('/')) return null

  const {
    teamToGroup = staticTeamToGroup,
    teamPositions = null,
    usedNumbers = null,
    matchMeta = null,
  } = options

  const candidates = roundOf32Map.filter(slot => {
    if (usedNumbers?.has(slot.match)) return false
    return fitsR32Slot(slot, home, away, teamToGroup, teamPositions)
  })

  const picked = disambiguateCatalogSlots(candidates, matchMeta || { utcDate: null, venue: null })
  return picked?.match ?? null
}

function catalogSlotsForStage(stage, utcDate) {
  return knockoutByDate.filter(r => {
    const stageOk =
      (stage === 'LAST_32' && r.n >= 73 && r.n <= 88) ||
      (stage === 'LAST_16' && r.n >= 89 && r.n <= 96) ||
      (stage === 'QUARTER_FINALS' && r.n >= 97 && r.n <= 100) ||
      (stage === 'SEMI_FINALS' && r.n >= 101 && r.n <= 102) ||
      (stage === 'THIRD_PLACE' && r.n === 103) ||
      (stage === 'FINAL' && r.n === 104)
    return stageOk && sameUtcDay(r.utcDate, utcDate)
  })
}

function resolveByVenueAndDate(m, usedNumbers) {
  const { utcDate, stage, venue } = extractFields(m)
  if (!stage || stage === 'GROUP_STAGE' || !utcDate) return null

  const candidates = catalogSlotsForStage(stage, utcDate).filter(
    slot => !usedNumbers?.has(slot.n),
  )
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0].n

  if (venue) {
    const byVenue = candidates.filter(r => sameVenue(r.venue, venue))
    if (byVenue.length === 1) return byVenue[0].n
  }

  const t = new Date(utcDate).getTime()
  const sorted = [...candidates].sort(
    (a, b) =>
      Math.abs(new Date(a.utcDate).getTime() - t) -
      Math.abs(new Date(b.utcDate).getTime() - t),
  )
  const best = Math.abs(new Date(sorted[0].utcDate).getTime() - t)
  const second = Math.abs(new Date(sorted[1].utcDate).getTime() - t)
  if (best < second) return sorted[0].n
  return null
}

/** Lado ganador (home/away) de un partido de eliminatorias crudo (API), con penaltis si hubo empate. */
function inferWinnerSideFromApiScore(score) {
  if (!score) return null
  if (score.winner === 'HOME_TEAM') return 'home'
  if (score.winner === 'AWAY_TEAM') return 'away'
  const pen = score.penaltyShootoutWinner
  if (pen === 'home' || pen === 'away') return pen
  return null
}

/** Referencia de cuadro (W74, L101…) a nombre de equipo real, según ganadores/perdedores ya jugados. */
function resolveBracketRefTeam(ref, winner, loser) {
  const w = /^W(\d+)$/.exec(ref)
  if (w) return winner.get(Number(w[1])) ?? null
  const l = /^L(\d+)$/.exec(ref)
  if (l) return loser.get(Number(l[1])) ?? null
  return null
}

function findBracketMatchFromMaps(home, away, roundId, winner, loser) {
  if (!roundId) return null
  for (const slot of KNOCKOUT_BRACKET_TREE) {
    if (slot.roundId !== roundId) continue
    const slotHome = resolveBracketRefTeam(slot.home, winner, loser)
    const slotAway = resolveBracketRefTeam(slot.away, winner, loser)
    if (!slotHome || !slotAway) continue
    if (
      (teamsMatch(home, slotHome) && teamsMatch(away, slotAway)) ||
      (teamsMatch(home, slotAway) && teamsMatch(away, slotHome))
    ) {
      return slot.match
    }
  }
  return null
}

const STAGE_TO_BRACKET_ROUND = {
  LAST_16: 'r16',
  QUARTER_FINALS: 'qf',
  SEMI_FINALS: 'sf',
  THIRD_PLACE: '3rd',
  FINAL: 'final',
}

/** Orden de resolución: cada ronda necesita los ganadores/perdedores ya resueltos de la anterior. */
const BRACKET_STAGE_ORDER = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']

function knockoutSideNames(m) {
  return {
    home: m.home || m.homeTeam?.shortName || m.homeTeam?.name,
    away: m.away || m.awayTeam?.shortName || m.awayTeam?.name,
  }
}

function buildKnockoutWinnerLoserMapsFromAssigned(allMatches, assignedById) {
  const winner = new Map()
  const loser = new Map()
  for (const m of allMatches || []) {
    if (!m.stage || m.stage === 'GROUP_STAGE') continue
    const n = assignedById.get(String(m.id))
    if (n == null) continue
    const { home, away } = knockoutSideNames(m)
    if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) continue
    const side = inferWinnerSideFromApiScore(m.score)
    if (!side) continue
    winner.set(n, side === 'home' ? home : away)
    loser.set(n, side === 'home' ? away : home)
  }
  return { winner, loser }
}

/**
 * Asigna números FIFA 73–104 ronda a ronda (sin colisiones).
 * @returns {Map<string, number>}
 */
export function assignKnockoutMatchNumbers(allMatches) {
  const assigned = new Map()
  const usedNumbers = new Set()
  const teamToGroup = buildTeamToGroupMap(allMatches)
  const teamPositions = buildTeamPositionsFromGroupStage(allMatches)

  function tryAssign(m, matchNumber) {
    if (matchNumber == null || matchNumber < 73 || matchNumber > FIFA_MATCH_COUNT) return
    if (usedNumbers.has(matchNumber)) return
    assigned.set(String(m.id), matchNumber)
    usedNumbers.add(matchNumber)
  }

  const r32 = (allMatches || [])
    .filter(m => m.stage === 'LAST_32')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))

  for (const m of r32) {
    if (
      m.matchNumber != null
      && m.matchNumber >= 73
      && m.matchNumber <= FIFA_MATCH_COUNT
      && !usedNumbers.has(m.matchNumber)
    ) {
      tryAssign(m, m.matchNumber)
      continue
    }
    const { home, away } = knockoutSideNames(m)
    let n = resolveR32MatchNumberByTeams(home, away, {
      teamToGroup,
      teamPositions,
      usedNumbers,
      matchMeta: m,
    })
    if (n == null) n = resolveByVenueAndDate(m, usedNumbers)
    tryAssign(m, n)
  }

  for (const stage of BRACKET_STAGE_ORDER.slice(1)) {
    const roundId = STAGE_TO_BRACKET_ROUND[stage]
    const stageMatches = (allMatches || [])
      .filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    const { winner, loser } = buildKnockoutWinnerLoserMapsFromAssigned(allMatches, assigned)

    for (const m of stageMatches) {
      if (assigned.has(String(m.id))) continue
      if (
        m.matchNumber != null
        && m.matchNumber >= 73
        && m.matchNumber <= FIFA_MATCH_COUNT
        && !usedNumbers.has(m.matchNumber)
      ) {
        tryAssign(m, m.matchNumber)
        continue
      }
      const { home, away } = knockoutSideNames(m)
      if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) continue
      let n = findBracketMatchFromMaps(home, away, roundId, winner, loser)
      if (n == null || usedNumbers.has(n)) n = resolveByVenueAndDate(m, usedNumbers)
      tryAssign(m, n)
    }
  }

  return assigned
}

/**
 * Ganador/perdedor real de cada partido de eliminatorias ya resuelto (73–104), indexado por
 * número FIFA. Sirve para desambiguar cruces de octavos+ cuando la fecha/recinto no bastan.
 */
function buildKnockoutWinnerLoserMaps(allMatches, assignedById = null) {
  if (assignedById?.size) {
    return buildKnockoutWinnerLoserMapsFromAssigned(allMatches, assignedById)
  }
  const assigned = assignKnockoutMatchNumbers(allMatches)
  return buildKnockoutWinnerLoserMapsFromAssigned(allMatches, assigned)
}

/**
 * Resuelve el número FIFA de un cruce de octavos en adelante por el equipo real, usando el
 * resultado real de las rondas anteriores (más fiable que fecha/recinto cuando varios cruces
 * de la misma ronda comparten plantilla).
 */
function resolveKnockoutMatchNumberByBracketSource(home, away, roundId, allMatches, assignedById) {
  if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) return null
  if (!roundId || !allMatches?.length) return null
  const { winner, loser } = buildKnockoutWinnerLoserMaps(allMatches, assignedById)
  if (!winner.size && !loser.size) return null
  return findBracketMatchFromMaps(home, away, roundId, winner, loser)
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
 * @param {object} m
 * @param {{ allMatches?: object[] }} [context] Partidos hermanos (misma consulta) para
 *   desambiguar octavos+ por equipo real cuando fecha/recinto no bastan.
 */
export function resolveFifaMatchNumber(m, context = {}) {
  const assignedId = m.id != null ? String(m.id) : null
  if (assignedId && context.assignedById?.has(assignedId)) {
    return context.assignedById.get(assignedId)
  }

  if (m.matchNumber != null && m.matchNumber >= 1 && m.matchNumber <= FIFA_MATCH_COUNT) {
    return m.matchNumber
  }

  const { group, home, away, utcDate, stage, venue } = extractFields(m)

  if (stage === 'GROUP_STAGE' || (!stage && group)) {
    const key = `${group}|${normalizeTeamName(home)}|${normalizeTeamName(away)}`
    const hit = groupByTeams.get(key)
    if (hit) return hit
    return null
  }

  const teamToGroup = buildTeamToGroupMap(context.allMatches)
  const teamPositions = buildTeamPositionsFromGroupStage(context.allMatches)

  if (stage === 'LAST_32') {
    const byTeams = resolveR32MatchNumberByTeams(home, away, {
      teamToGroup,
      teamPositions,
      matchMeta: m,
    })
    if (byTeams != null) return byTeams
  }

  const bracketRoundId = STAGE_TO_BRACKET_ROUND[stage]
  if (bracketRoundId) {
    const byTeams = resolveKnockoutMatchNumberByBracketSource(
      home,
      away,
      bracketRoundId,
      context.allMatches,
      context.assignedById,
    )
    if (byTeams != null) return byTeams
  }

  if (stage && stage !== 'GROUP_STAGE') {
    return resolveByVenueAndDate(m, context.usedNumbers)
  }

  if (utcDate) {
    const dayHits = knockoutByDate.filter(r => sameUtcDay(r.utcDate, utcDate))
    if (dayHits.length === 1) return dayHits[0].n
  }

  return null
}

export function enrichMatch(m, context = {}) {
  const matchNumber = resolveFifaMatchNumber(m, context)
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

/**
 * Enriquece partidos crudos de la API (FotMob / football-data) con número FIFA único.
 */
export function enrichApiMatches(apiMatches) {
  const assignedById = assignKnockoutMatchNumbers(apiMatches)
  const context = { allMatches: apiMatches, assignedById }
  return (apiMatches || []).map(m => {
    const preassigned = assignedById.get(String(m.id))
    const withNumber =
      preassigned != null
        ? { ...m, matchNumber: preassigned }
        : m
    return enrichMatch(withNumber, context)
  })
}

/** Índice matchNumber → id API (cuando hay partidos enriquecidos). */
export function buildMatchNumberToIdMap(matches) {
  const out = {}
  for (const m of matches || []) {
    if (m.matchNumber != null && m.id) out[m.matchNumber] = String(m.id)
  }
  return out
}
