import { getKnockoutFifaCatalog, formatFifaMatchLabel } from './fifaMatchNumbers.js'
import { formatFifaSlotCode, formatKnockoutMatchupLabel } from './formatFifaSlot.js'

export const BRACKET_ROUND_ORDER = [
  { id: 'r32', label: 'Dieciseisavos de final', shortLabel: 'Dieciseisavos', from: 73, to: 88 },
  { id: 'r16', label: 'Octavos de final', shortLabel: 'Octavos', from: 89, to: 96 },
  { id: 'qf', label: 'Cuartos de final', shortLabel: 'Cuartos', from: 97, to: 100 },
  { id: 'sf', label: 'Semifinales', shortLabel: 'Semifinales', from: 101, to: 102 },
  { id: '3rd', label: 'Tercer y cuarto puesto', shortLabel: '3.er puesto', from: 103, to: 103 },
  { id: 'final', label: 'Final', shortLabel: 'Final', from: 104, to: 104 },
]

export const KNOCKOUT_ROUND_IDS = BRACKET_ROUND_ORDER.map(r => r.id)

export function getKnockoutRoundSectionLabel(roundId) {
  const round = BRACKET_ROUND_ORDER.find(r => r.id === roundId)
  return round?.shortLabel ?? round?.label ?? roundId
}

/** Secciones ordenadas (dieciseisavos → final) para calendario de eliminatorias. */
export function groupMatchesByKnockoutRound(matches = []) {
  const buckets = new Map()
  for (const m of matches) {
    const id = m.roundId || 'r32'
    if (!buckets.has(id)) buckets.set(id, [])
    buckets.get(id).push(m)
  }
  return KNOCKOUT_ROUND_IDS.filter(id => buckets.has(id)).map(id => ({
    key: id,
    label: getKnockoutRoundSectionLabel(id),
    items: buckets
      .get(id)
      .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0)),
  }))
}

function slotSideLabel(source, teamName) {
  if (teamName && !/^[123WLPG][\dA-L/]*$/.test(String(teamName))) return teamName
  return formatFifaSlotCode(source) || teamName || '—'
}

/**
 * Agrupa el catálogo FIFA 73–104 con partidos resueltos (API o porra prevista).
 * @param {object[]} matches
 */
/** Lista plana 73–104 para calendario (API + huecos del catálogo FIFA). */
export function flattenKnockoutSchedule(matches = []) {
  return buildBracketRounds(matches).flatMap(round => round.matches)
}

export function buildBracketRounds(matches = []) {
  const catalog = getKnockoutFifaCatalog()
  const byNum = Object.fromEntries(
    (matches || [])
      .filter(m => m.matchNumber != null)
      .map(m => [m.matchNumber, m]),
  )

  return BRACKET_ROUND_ORDER.map(round => ({
    id: round.id,
    label: round.label,
    matches: catalog
      .filter(c => c.n >= round.from && c.n <= round.to)
      .map(slot => {
        const m = byNum[slot.n]
        const homeSource = m?.homeSource ?? slot.homeSource
        const awaySource = m?.awaySource ?? slot.awaySource
        return {
          id: m?.id ?? `bracket-${slot.n}`,
          matchNumber: slot.n,
          fifaMatchLabel: formatFifaMatchLabel(slot.n),
          knockoutMatchupLabel: formatKnockoutMatchupLabel(homeSource, awaySource),
          home: slotSideLabel(homeSource, m?.home),
          away: slotSideLabel(awaySource, m?.away),
          homeCrest: m?.homeCrest ?? null,
          awayCrest: m?.awayCrest ?? null,
          homeSource,
          awaySource,
          venue: m?.venue ?? slot.venue,
          utcDate: m?.utcDate ?? slot.utcDate,
          roundId: round.id,
          roundLabel: round.shortLabel ?? round.label,
          isPredictedBracket: m?.isPredictedBracket,
        }
      }),
  }))
}
