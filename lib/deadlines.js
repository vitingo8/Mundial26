import { fromMadridDatetimeLocal } from './madridTime'
import { isDeadlinePassed } from './gameData'

/** 11 jun 2026, 21:00 — hora de Madrid (pitido México–Sudáfrica). */
export const DEFAULT_TOURNAMENT_OPEN_MADRID = '2026-06-11T21:00'

/** 28 jun 2026, 21:00 — hora de Madrid (pitido partido 73, inicio eliminatorias). */
export const DEFAULT_KNOCKOUT_CLOSE_MADRID = '2026-06-28T21:00'

let cachedDefaultOpenUtc = null
let cachedDefaultKnockoutUtc = null

export function getDefaultGroupDeadline() {
  if (!cachedDefaultOpenUtc) {
    cachedDefaultOpenUtc =
      fromMadridDatetimeLocal(DEFAULT_TOURNAMENT_OPEN_MADRID) || '2026-06-11T19:00:00.000Z'
  }
  return cachedDefaultOpenUtc
}

export function getDefaultBonusDeadline() {
  return getDefaultGroupDeadline()
}

export function getDefaultKnockoutDeadline() {
  if (!cachedDefaultKnockoutUtc) {
    cachedDefaultKnockoutUtc =
      fromMadridDatetimeLocal(DEFAULT_KNOCKOUT_CLOSE_MADRID) || '2026-06-28T19:00:00.000Z'
  }
  return cachedDefaultKnockoutUtc
}

/** Plazo Inicio (grupos + cuadro previsto KO). */
export function getEffectiveGroupDeadline(group) {
  return group?.group_deadline || getDefaultGroupDeadline()
}

/** Plazo Especiales (goleador, MVP, etc.) — antes del pitido de apertura. */
export function getEffectiveBonusDeadline(group) {
  return group?.bonus_deadline || group?.group_deadline || getDefaultBonusDeadline()
}

export function isGroupDeadlinePassed(group) {
  return isDeadlinePassed(getEffectiveGroupDeadline(group))
}

export function isBonusDeadlinePassed(group) {
  return isDeadlinePassed(getEffectiveBonusDeadline(group))
}

/** Plazo porra Eliminatorias reales (40%). */
export function getEffectiveKnockoutDeadline(group) {
  return group?.knockout_deadline || getDefaultKnockoutDeadline()
}

export function isKnockoutDeadlinePassed(group) {
  return isDeadlinePassed(getEffectiveKnockoutDeadline(group))
}

/** Bloqueo al pitido (UTC del partido). */
export function isMatchKickoffPassed(utcDate, now = new Date()) {
  if (!utcDate) return false
  const kickoff = new Date(utcDate).getTime()
  if (Number.isNaN(kickoff)) return false
  return now.getTime() >= kickoff
}

/** @deprecated Usa isKnockoutDeadlinePassed(group). */
export function isKnockoutPhaseFullyLocked(groupOrMatches) {
  if (groupOrMatches && typeof groupOrMatches === 'object' && !Array.isArray(groupOrMatches)) {
    return isKnockoutDeadlinePassed(groupOrMatches)
  }
  return false
}
