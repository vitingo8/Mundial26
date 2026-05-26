import { computeGroupStandings } from './groupStandings.js'
import {
  generateRoundOf32,
  standingsBlocksToGroupsInput,
} from './knockout/dist/index.js'
import { roundOf32Map } from './knockout/dist/config/roundOf32Map.js'
import { thirdPlaceCombinationMap } from './knockout/dist/config/thirdPlaceCombinationMap.js'

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

/** Convierte partidos generados al formato del calendario (MatchDaySchedule). */
export function generatedKnockoutToSchedule(generated) {
  if (!generated?.matches?.length) return []
  return generated.matches.map(m => ({
    id: `inicio-r32-${m.matchNumber}`,
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
  }))
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

export function buildInicioKnockoutSchedule(groupMatches, scoresMap) {
  const built = buildPredictedRoundOf32(groupMatches, scoresMap)
  if (!built.ok) {
    return { schedule: [], error: built.error, combinationKey: null }
  }
  return {
    schedule: generatedKnockoutToSchedule(built.data),
    error: null,
    combinationKey: built.data.combinationKey,
  }
}
