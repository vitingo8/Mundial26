import { NextResponse } from 'next/server'
import groupStageCatalog from '../../../../lib/fifaMatchCatalog/groupStage.json' with { type: 'json' }
import {
  formatFifaMatchLabel,
  formatFifaSlotCode,
  formatKnockoutMatchupLabel,
  getKnockoutFifaCatalog,
  FIFA_MATCH_COUNT,
} from '../../../../lib/fifaMatchNumbers'

export const dynamic = 'force-dynamic'

/** Catálogo estático FIFA (partidos 1–104), sin depender de football-data.org */
export async function GET() {
  const group = groupStageCatalog.map(row => ({
    matchNumber: row.n,
    fifaMatchLabel: formatFifaMatchLabel(row.n),
    stage: 'GROUP_STAGE',
    group: row.g,
    home: row.home,
    away: row.away,
    utcDate: row.utcDate ?? null,
  }))

  const knockout = getKnockoutFifaCatalog().map(row => ({
    matchNumber: row.n,
    fifaMatchLabel: formatFifaMatchLabel(row.n),
    stage: row.stage,
    utcDate: row.utcDate,
    venue: row.venue,
    homeSource: row.homeSource,
    awaySource: row.awaySource,
    homeSlotLabel: formatFifaSlotCode(row.homeSource),
    awaySlotLabel: formatFifaSlotCode(row.awaySource),
    knockoutMatchupLabel: formatKnockoutMatchupLabel(row.homeSource, row.awaySource),
  }))

  return NextResponse.json({
    total: FIFA_MATCH_COUNT,
    matches: [...group, ...knockout],
  })
}
