import { computeGroupStandings } from './groupStandings.js'

import {

  generateRoundOf32,

  standingsBlocksToGroupsInput,

} from './knockout/dist/index.js'

import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'

import { thirdPlaceCombinationMap } from './knockout/dist/config/thirdPlaceCombinationMap.js'

import { KNOCKOUT_BRACKET_TREE } from './knockoutBracketTree.js'
import { resolveKnockoutWinnerTeam } from './knockoutAdvances.js'
import { flattenKnockoutSchedule } from './knockoutBracketDisplay.js'
import { hydrateKnockoutR32FromStandings, buildLiveKnockoutMatches } from './hydrateKnockoutR32.js'

function isGroupScoreFilled(pred) {
  return (
    pred &&
    pred.home != null &&
    pred.away != null &&
    !Number.isNaN(Number(pred.home)) &&
    !Number.isNaN(Number(pred.away))
  )
}

function countFilledGroupMatches(groupMatches, scoresMap) {
  return groupMatches.filter(m => isGroupScoreFilled(scoresMap[m.id])).length
}

import { formatFifaMatchLabel, formatKnockoutMatchupLabel } from './fifaMatchNumbers.js'

import { formatFifaSlotCode } from './formatFifaSlot.js'
import { isResolvedTeamName } from './resolvedTeamName.js'
import { displayTeamName } from './teamNamesEs.js'



export const INICIO_KO_ID_PREFIX = 'inicio-ko-'

/** Partidos 89–104 de la porra Eliminatorias (cuadro del usuario). */
export const KNOCKOUT_REAL_KO_PREFIX = 'knockout-ko-'

const LEGACY_R32_PREFIX = 'inicio-r32-'

const R32_MATCH_FROM = 73
const R32_MATCH_TO = 88



/** Normaliza claves antiguas inicio-r32-N → inicio-ko-N */

export function normalizeInicioKoPreds(preds = {}) {

  const out = { ...preds }

  for (const [key, val] of Object.entries(preds)) {

    if (!key.startsWith(LEGACY_R32_PREFIX)) continue

    const num = key.slice(LEGACY_R32_PREFIX.length)

    const canonical = `${INICIO_KO_ID_PREFIX}${num}`

    if (!out[canonical]) out[canonical] = val

  }

  return out

}



export function inicioKoMatchId(matchNumber) {

  return `${INICIO_KO_ID_PREFIX}${matchNumber}`

}



export function knockoutRealKoMatchId(matchNumber) {

  return `${KNOCKOUT_REAL_KO_PREFIX}${matchNumber}`

}



export function parseKnockoutRealKoMatchNumber(id) {

  const m = String(id).match(new RegExp(`^${KNOCKOUT_REAL_KO_PREFIX}(\\d+)$`))

  return m ? parseInt(m[1], 10) : null

}

export function parseInicioKoMatchNumber(id) {
  const m = String(id).match(new RegExp(`^${INICIO_KO_ID_PREFIX}(\\d+)$`))
  return m ? parseInt(m[1], 10) : null
}

/** Predicción de cuadro Inicio por id de partido o número FIFA. */
export function lookupInicioKoPred(preds = {}, match) {
  if (!match) return {}
  const map = preds || {}
  const id = String(match.id)
  if (map[id]) return map[id]
  if (match.matchNumber != null) {
    const canonical = inicioKoMatchId(match.matchNumber)
    if (map[canonical]) return map[canonical]
    const legacy = `${LEGACY_R32_PREFIX}${match.matchNumber}`
    if (map[legacy]) return map[legacy]
  }
  return {}
}

export function isInicioKoMatchId(id) {
  const s = String(id || '')
  return s.startsWith(INICIO_KO_ID_PREFIX) || s.startsWith(LEGACY_R32_PREFIX)
}

/** Predicción eliminatorias (40%): id API en dieciseisavos o knockout-ko-N. */
export function lookupEliminatoriasKoPred(preds = {}, match) {
  if (!match) return null
  const map = preds || {}
  const primary = predIdForEliminatoriasMatch(match)
  if (map[primary]) return map[primary]
  if (match.matchNumber != null) {
    const alt = knockoutRealKoMatchId(match.matchNumber)
    if (map[alt]) return map[alt]
  }
  const rawId = match.id != null ? String(match.id) : null
  if (rawId && map[rawId]) return map[rawId]
  return null
}

/** Cuadro KO: Inicio (inicio-ko-N) o eliminatorias según el id del partido. */
export function lookupBracketPred(preds = {}, match) {
  if (!match) return {}
  if (isInicioKoMatchId(match.id)) return lookupInicioKoPred(preds, match)
  const elim = lookupEliminatoriasKoPred(preds, match)
  return elim || {}
}



/** Solo dieciseisavos reales (partidos 73–88 / LAST_32). */
export function filterApiKnockoutR32(matches = []) {

  return (matches || []).filter(m => {

    if (m.roundId === 'r32' || m.stage === 'LAST_32') return true

    const n = m.matchNumber

    return n != null && n >= R32_MATCH_FROM && n <= R32_MATCH_TO

  })

}



/** Id de predicción: id API cuando existe; si no, knockout-ko-N. */
export function predIdForEliminatoriasMatch(matchRow) {

  if (!matchRow) return knockoutRealKoMatchId(0)

  const id = matchRow.id != null ? String(matchRow.id) : ''
  const isSyntheticId =
    id.startsWith('bracket-') ||
    id.startsWith(INICIO_KO_ID_PREFIX) ||
    id.startsWith(KNOCKOUT_REAL_KO_PREFIX) ||
    id.startsWith(LEGACY_R32_PREFIX)

  if (id && !isSyntheticId) {
    return id
  }

  const n = matchRow.matchNumber

  if (n != null) return knockoutRealKoMatchId(n)

  return knockoutRealKoMatchId(0)

}



/**

 * Genera dieciseisavos previstos a partir de marcadores de grupos (porra Inicio).

 * @returns {{ ok: true, data: object } | { ok: false, error: string }}

 */

export function buildPredictedRoundOf32(groupMatches, scoresMap) {

  const blocks = computeGroupStandings(groupMatches, scoresMap)

  if (blocks.length < 12) {

    return {

      ok: false,

      error: `Faltan grupos en la clasificación (${blocks.length}/12). Rellena todos los partidos de grupos.`,

    }

  }



  const groups = standingsBlocksToGroupsInput(blocks)



  try {

    const data = generateRoundOf32(groups, roundOf32Map, thirdPlaceCombinationMap)

    return { ok: true, data }

  } catch (e) {

    return { ok: false, error: e?.message || String(e) }

  }

}



function lookupKoPred(preds, matchRow, predIdForMatch) {
  return lookupEliminatoriasKoPred(preds, matchRow) ?? preds[predIdForMatch(matchRow)]
}



function winnerFromPred(matchRow, preds, predIdForMatch) {
  const pred = lookupKoPred(preds, matchRow, predIdForMatch)
  const w = resolveKnockoutWinnerTeam(pred, matchRow)
  if (w) return { name: w.name, crest: w.crest }
  return null
}



function loserFromPred(matchRow, preds, predIdForMatch) {
  const pred = lookupKoPred(preds, matchRow, predIdForMatch)
  const w = resolveKnockoutWinnerTeam(pred, matchRow)
  if (!w) return null
  if (w.side === 'home') {
    return { name: matchRow.away, crest: matchRow.awayCrest ?? null }
  }
  return { name: matchRow.home, crest: matchRow.homeCrest ?? null }
}



function resolveBracketSide(ref, byMatchNum, preds, predIdForMatch) {

  const w = ref.match(/^W(\d+)$/)

  if (w) {

    const num = parseInt(w[1], 10)

    const row = byMatchNum[num]

    if (!row) return null

    return winnerFromPred(row, preds, predIdForMatch)

  }

  const l = ref.match(/^L(\d+)$/)

  if (l) {

    const num = parseInt(l[1], 10)

    const row = byMatchNum[num]

    if (!row) return null

    return loserFromPred(row, preds, predIdForMatch)

  }

  return null

}



function placeholderBracketSide(ref) {

  return { name: formatFifaSlotCode(ref), crest: null }

}



/** Equipo resuelto por predicción o etiqueta G74 / P101 si aún no hay ganador. */

function resolveBracketSideOrPlaceholder(ref, byMatchNum, preds, predIdForMatch) {

  return resolveBracketSide(ref, byMatchNum, preds, predIdForMatch) || placeholderBracketSide(ref)

}



/** Convierte partidos generados al formato del calendario (MatchDaySchedule). */

export function generatedKnockoutToSchedule(generated) {

  if (!generated?.matches?.length) return []

  return generated.matches.map(m => ({

    id: inicioKoMatchId(m.matchNumber),

    matchNumber: m.matchNumber,

    fifaMatchLabel: formatFifaMatchLabel(m.matchNumber),

    knockoutMatchupLabel: formatKnockoutMatchupLabel(m.homeSource, m.awaySource),

    roundId: 'r32',

    roundLabel: 'Dieciseisavos (previstos)',

    home: displayTeamName(m.homeTeam.name),

    away: displayTeamName(m.awayTeam.name),

    homeCrest: m.homeTeam.crest ?? null,

    awayCrest: m.awayTeam.crest ?? null,

    venue: m.venue,

    homeSource: m.homeSource,

    awaySource: m.awaySource,

    awayResolvedGroup: m.awayResolvedGroup,

    homeResolvedGroup: m.homeResolvedGroup,

    isPredictedBracket: true,

    combinationKey: generated.combinationKey,

    utcDate: m.utcDate,

  }))

}



function bracketSlotToScheduleRow(slot, home, away, { id, isPredictedBracket = true }) {

  return {

    id,

    matchNumber: slot.match,

    fifaMatchLabel: formatFifaMatchLabel(slot.match),

    homeSource: slot.home,

    awaySource: slot.away,

    knockoutMatchupLabel: formatKnockoutMatchupLabel(slot.home, slot.away),

    roundId: slot.roundId,

    roundLabel: slot.roundLabel,

    home: displayTeamName(home.name),

    away: displayTeamName(away.name),

    homeCrest: home.crest,

    awayCrest: away.crest,

    venue: slot.venue,

    utcDate: slot.utcDate,

    isPredictedBracket,

  }

}



function appendBracketRoundsFromR32(r32Schedule, preds, predIdForMatch, { laterRoundPredicted = true } = {}) {

  const byMatchNum = Object.fromEntries(r32Schedule.map(m => [m.matchNumber, m]))

  const extra = []



  for (const slot of KNOCKOUT_BRACKET_TREE) {

    const home = resolveBracketSideOrPlaceholder(slot.home, byMatchNum, preds, predIdForMatch)

    const away = resolveBracketSideOrPlaceholder(slot.away, byMatchNum, preds, predIdForMatch)

    const existing = byMatchNum[slot.match]

    const id =

      slot.match >= R32_MATCH_FROM && slot.match <= R32_MATCH_TO && existing?.id

        ? String(existing.id)

        : predIdForMatch({ matchNumber: slot.match, id: existing?.id })

    const row = bracketSlotToScheduleRow(slot, home, away, {

      id,

      isPredictedBracket: laterRoundPredicted || slot.match > R32_MATCH_TO,

    })

    byMatchNum[slot.match] = row

    extra.push(row)

  }



  return [...r32Schedule, ...extra]

}



function appendBracketRounds(r32Schedule, inicioKoPreds) {

  const preds = normalizeInicioKoPreds(inicioKoPreds)

  return appendBracketRoundsFromR32(r32Schedule, preds, row => inicioKoMatchId(row.matchNumber), {

    laterRoundPredicted: true,

  })

}



/**
 * Porra Eliminatorias: mismos partidos que En vivo (dieciseisavos hidratados + fases API).
 */
export function buildEliminatoriasKnockoutSchedule(
  apiKnockoutMatches = [],
  _koPreds = {},
  { fotmobStandings = null, groupMatches = [], apiMatches = [] } = {},
) {
  const liveMatches = buildLiveKnockoutMatches(
    apiKnockoutMatches,
    fotmobStandings,
    groupMatches,
    apiMatches,
  )

  return liveMatches.map(m => {
    const bothResolved = isResolvedTeamName(m.home) && isResolvedTeamName(m.away)
    return {
      ...m,
      id: predIdForEliminatoriasMatch(m),
      isPredictedBracket: bothResolved ? false : (m.isPredictedBracket ?? true),
    }
  })
}



const COMBINATION_HINT =

  'Esta combinación aún no está en la tabla oficial configurada en el servidor.'



/** Texto principal del aviso (castellano). */

export function formatKnockoutErrorForUi(error) {

  if (!error) return ''

  const legacy = error.match(

    /^No third-place assignment found for combination ([A-L]+)$/,

  )

  if (legacy) {

    return `No hay asignación de mejores terceros para la combinación ${legacy[1]}.`

  }

  return error

}



export function knockoutErrorShowsCombinationHint(error) {

  if (!error) return false

  return (

    /No third-place assignment found for combination/.test(error) ||

    /No hay asignación de mejores terceros para la combinación/.test(error)

  )

}



export function getKnockoutErrorHint(error) {

  return knockoutErrorShowsCombinationHint(error) ? COMBINATION_HINT : null

}



/**

 * Calendario completo de eliminatorias previstas (dieciseisavos → final)

 * según grupos + marcadores de cada ronda en inicioKoPreds.

 */

export function buildInicioKnockoutSchedule(groupMatches, scoresMap, inicioKoPreds = {}) {
  if (countFilledGroupMatches(groupMatches, scoresMap) === 0) {
    return { schedule: [], error: null, combinationKey: null }
  }

  const built = buildPredictedRoundOf32(groupMatches, scoresMap)

  if (!built.ok) {

    return { schedule: [], error: built.error, combinationKey: null }

  }



  const r32 = generatedKnockoutToSchedule(built.data)

  const schedule = appendBracketRounds(r32, inicioKoPreds)



  return {

    schedule,

    error: null,

    combinationKey: built.data.combinationKey,

  }

}


