import { isResolvedTeamName } from './resolvedTeamName.js'
import { isKnockoutMatchPendingThird } from './knockoutThirdSlots.js'

function isKickoffPassed(utcDate, now = new Date()) {
  if (!utcDate) return false
  const kickoff = new Date(utcDate).getTime()
  if (Number.isNaN(kickoff)) return false
  return now.getTime() >= kickoff
}

/**
 * Eliminatorias (40%): editable cuando ambos equipos están definidos en el cuadro real
 * y hasta el pitido del partido.
 */
export function isEliminatoriasMatchEditable(match, { phaseLocked = false, now = new Date() } = {}) {
  if (phaseLocked) return false
  if (isKnockoutMatchPendingThird(match)) return false
  if (!isResolvedTeamName(match?.home) || !isResolvedTeamName(match?.away)) return false
  if (isKickoffPassed(match?.utcDate, now)) return false
  return true
}

export function isEliminatoriasMatchLocked(match, options = {}) {
  return !isEliminatoriasMatchEditable(match, options)
}
