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

/**
 * Ganador/perdedor real de cada partido de eliminatorias ya resuelto (73–104), indexado por
 * número FIFA. Sirve para desambiguar cruces de octavos+ cuando la fecha/recinto no bastan
 * (varios cruces de la misma ronda comparten plantilla de fecha, p. ej. 89/90 o 99/100):
 * se resuelve ronda a ronda (dieciseisavos por grupo, el resto por equipo real ya conocido).
 */
function buildKnockoutWinnerLoserMaps(allMatches) {
  const winner = new Map()
  const loser = new Map()
  const byStage = new Map()
  for (const m of allMatches || []) {
    if (!m.stage || m.stage === 'GROUP_STAGE') continue
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage).push(m)
  }

  for (const stage of BRACKET_STAGE_ORDER) {
    const roundId = STAGE_TO_BRACKET_ROUND[stage] ?? null
    for (const m of byStage.get(stage) || []) {
      const home = m.home || m.homeTeam?.shortName || m.homeTeam?.name
      const away = m.away || m.awayTeam?.shortName || m.awayTeam?.name
      if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) continue
      let n = m.matchNumber != null && m.matchNumber >= 73 && m.matchNumber <= 104 ? m.matchNumber : null
      if (n == null) {
        n = stage === 'LAST_32'
          ? resolveR32MatchNumberByTeams(home, away)
          : findBracketMatchFromMaps(home, away, roundId, winner, loser)
      }
      if (n == null) continue
      const side = inferWinnerSideFromApiScore(m.score)
      if (!side) continue
      winner.set(n, side === 'home' ? home : away)
      loser.set(n, side === 'home' ? away : home)
    }
  }
  return { winner, loser }
}

/**
 * Resuelve el número FIFA de un cruce de octavos en adelante por el equipo real, usando el
 * resultado real de las rondas anteriores (más fiable que fecha/recinto cuando varios cruces
 * de la misma ronda comparten plantilla).
 */
function resolveKnockoutMatchNumberByBracketSource(home, away, roundId, allMatches) {
  if (!isResolvedTeamName(home) || !isResolvedTeamName(away)) return null
  if (!roundId || !allMatches?.length) return null
  const { winner, loser } = buildKnockoutWinnerLoserMaps(allMatches)
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

  if (stage === 'LAST_32') {
    const byTeams = resolveR32MatchNumberByTeams(home, away)
    if (byTeams != null) return byTeams
  }

  const bracketRoundId = STAGE_TO_BRACKET_ROUND[stage]
  if (bracketRoundId) {
    const byTeams = resolveKnockoutMatchNumberByBracketSource(
      home,
      away,
      bracketRoundId,
      context.allMatches,
    )
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
    if (stageMatches.length > 1) {
      // Varios cruces de la ronda caen el mismo día (fechas plantilla iguales):
      // el recinto es más fiable que la hora para desambiguar.
      if (venue) {
        const byVenue = stageMatches.filter(r => sameVenue(r.venue, venue))
        if (byVenue.length === 1) return byVenue[0].n
      }
      if (utcDate) {
        const t = new Date(utcDate).getTime()
        stageMatches.sort(
          (a, b) =>
            Math.abs(new Date(a.utcDate).getTime() - t) -
            Math.abs(new Date(b.utcDate).getTime() - t),
        )
        return stageMatches[0].n
      }
    }
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
 * Enriquece partidos crudos de football-data.org.
 * Si dos partidos de eliminatorias distintos resolviesen el mismo número FIFA
 * (plantillas de fecha/hora ambiguas para cruces del mismo día), se conserva
 * el número solo en el primero y el resto queda sin número — mejor sin
 * etiqueta "Partido N" que mostrar el mismo número duplicado en dos partidos.
 */
export function enrichApiMatches(apiMatches) {
  const usedKnockoutNumbers = new Set()
  const context = { allMatches: apiMatches }
  return (apiMatches || []).map(m => {
    const enriched = enrichMatch(m, context)
    const n = enriched.matchNumber
    if (n != null && n > 72) {
      if (usedKnockoutNumbers.has(n)) {
        return { ...enriched, matchNumber: undefined, fifaMatchLabel: null }
      }
      usedKnockoutNumbers.add(n)
    }
    return enriched
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
