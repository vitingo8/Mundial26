/**
 * Etiquetas de plaza FIFA para eliminatorias.
 * - 1H, 2J, 3A/B/C… (dieciseisavos)
 * - W74 / G74 → ganador del partido 74
 * - L101 / P101 → perdedor del partido 101 (3.er puesto)
 */

export function formatFifaSlotCode(code) {
  if (!code) return ''
  if (/^[123][A-L]$/.test(code) || code.includes('/')) return code
  const w = String(code).match(/^W(\d+)$/)
  if (w) return `G${w[1]}`
  const l = String(code).match(/^L(\d+)$/)
  if (l) return `P${l[1]}`
  return code
}

export function formatKnockoutMatchupLabel(homeSource, awaySource) {
  const h = formatFifaSlotCode(homeSource)
  const a = formatFifaSlotCode(awaySource)
  if (!h || !a) return null
  return `${h} vs ${a}`
}
