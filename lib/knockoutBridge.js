import { computeGroupStandings } from './groupStandings.js'

import {

  generateRoundOf32,

  standingsBlocksToGroupsInput,

} from './knockout/dist/index.js'

import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'

import { thirdPlaceCombinationMap } from './knockout/dist/config/thirdPlaceCombinationMap.js'

import { KNOCKOUT_BRACKET_TREE } from './knockoutBracketTree.js'



export const INICIO_KO_ID_PREFIX = 'inicio-ko-'

const LEGACY_R32_PREFIX = 'inicio-r32-'



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



function winnerFromPred(matchRow, preds) {

  const id = inicioKoMatchId(matchRow.matchNumber)

  const pred = preds[id]

  if (!pred || pred.home == null || pred.away == null) return null

  const h = Number(pred.home)

  const a = Number(pred.away)

  if (Number.isNaN(h) || Number.isNaN(a)) return null

  if (h > a) {

    return { name: matchRow.home, crest: matchRow.homeCrest ?? null }

  }

  if (a > h) {

    return { name: matchRow.away, crest: matchRow.awayCrest ?? null }

  }

  return null

}



function loserFromPred(matchRow, preds) {

  const id = inicioKoMatchId(matchRow.matchNumber)

  const pred = preds[id]

  if (!pred || pred.home == null || pred.away == null) return null

  const h = Number(pred.home)

  const a = Number(pred.away)

  if (Number.isNaN(h) || Number.isNaN(a)) return null

  if (h > a) {

    return { name: matchRow.away, crest: matchRow.awayCrest ?? null }

  }

  if (a > h) {

    return { name: matchRow.home, crest: matchRow.homeCrest ?? null }

  }

  return null

}



function resolveBracketSide(ref, byMatchNum, preds) {

  const w = ref.match(/^W(\d+)$/)

  if (w) {

    const num = parseInt(w[1], 10)

    const row = byMatchNum[num]

    if (!row) return null

    return winnerFromPred(row, preds)

  }

  const l = ref.match(/^L(\d+)$/)

  if (l) {

    const num = parseInt(l[1], 10)

    const row = byMatchNum[num]

    if (!row) return null

    return loserFromPred(row, preds)

  }

  return null

}



/** Convierte partidos generados al formato del calendario (MatchDaySchedule). */

export function generatedKnockoutToSchedule(generated) {

  if (!generated?.matches?.length) return []

  return generated.matches.map(m => ({

    id: inicioKoMatchId(m.matchNumber),

    matchNumber: m.matchNumber,

    roundId: 'r32',

    roundLabel: 'Dieciseisavos (previstos)',

    home: m.homeTeam.name,

    away: m.awayTeam.name,

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



function bracketSlotToScheduleRow(slot, home, away) {

  return {

    id: inicioKoMatchId(slot.match),

    matchNumber: slot.match,

    roundId: slot.roundId,

    roundLabel: slot.roundLabel,

    home: home.name,

    away: away.name,

    homeCrest: home.crest,

    awayCrest: away.crest,

    venue: slot.venue,

    utcDate: slot.utcDate,

    isPredictedBracket: true,

  }

}



function appendBracketRounds(r32Schedule, inicioKoPreds) {

  const preds = normalizeInicioKoPreds(inicioKoPreds)

  const byMatchNum = Object.fromEntries(r32Schedule.map(m => [m.matchNumber, m]))

  const extra = []



  for (const slot of KNOCKOUT_BRACKET_TREE) {

    const home = resolveBracketSide(slot.home, byMatchNum, preds)

    const away = resolveBracketSide(slot.away, byMatchNum, preds)

    if (!home || !away) continue

    const row = bracketSlotToScheduleRow(slot, home, away)

    byMatchNum[slot.match] = row

    extra.push(row)

  }



  return [...r32Schedule, ...extra]

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


