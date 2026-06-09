import groupStageCatalog from './fifaMatchCatalog/groupStage.json' with { type: 'json' }
import { getKnockoutFifaCatalog } from './fifaMatchNumbers.js'
import { formatFifaSlotCode } from './formatFifaSlot.js'

/** Partidos en formato football-data.org desde el catálogo estático FIFA (sin API externa). */
export function buildCatalogApiMatches() {
  const group = groupStageCatalog.map(row => ({
    id: `catalog-${row.n}`,
    stage: 'GROUP_STAGE',
    group: `GROUP_${row.g}`,
    utcDate: row.utcDate,
    venue: null,
    status: 'SCHEDULED',
    matchday: null,
    homeTeam: { shortName: row.home, name: row.home, crest: null },
    awayTeam: { shortName: row.away, name: row.away, crest: null },
    matchNumber: row.n,
  }))

  const knockout = getKnockoutFifaCatalog().map(row => {
    const homeLabel = formatFifaSlotCode(row.homeSource)
    const awayLabel = formatFifaSlotCode(row.awaySource)
    return {
      id: `catalog-${row.n}`,
      stage: row.stage,
      utcDate: row.utcDate,
      venue: row.venue,
      status: 'SCHEDULED',
      homeTeam: { shortName: homeLabel, name: homeLabel, crest: null },
      awayTeam: { shortName: awayLabel, name: awayLabel, crest: null },
      matchNumber: row.n,
      homeSource: row.homeSource,
      awaySource: row.awaySource,
    }
  })

  return [...group, ...knockout]
}
