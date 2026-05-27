import { fromMadridDatetimeLocal } from './madridTime'
import { isDeadlinePassed } from './gameData'

/** 11 jun 2026, 21:00 — hora de Madrid (pitido México–Sudáfrica). */
export const DEFAULT_TOURNAMENT_OPEN_MADRID = '2026-06-11T21:00'

let cachedDefaultOpenUtc = null

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

/** Bloqueo al pitido (UTC del partido). */
export function isMatchKickoffPassed(utcDate, now = new Date()) {
  if (!utcDate) return false
  const kickoff = new Date(utcDate).getTime()
  if (Number.isNaN(kickoff)) return false
  return now.getTime() >= kickoff
}

/** Eliminatorias reales: editable hasta el pitido de cada partido. */
export function isKnockoutMatchEditable(utcDate) {
  return !isMatchKickoffPassed(utcDate)
}

export function isKnockoutPhaseFullyLocked(knockoutMatches = []) {
  if (!knockoutMatches.length) return false
  return knockoutMatches.every(m => isMatchKickoffPassed(m.utcDate))
}

export function getNextKnockoutLockKickoff(knockoutMatches = [], now = new Date()) {
  const t = now.getTime()
  const upcoming = knockoutMatches
    .filter(m => m.utcDate && new Date(m.utcDate).getTime() > t)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
  return upcoming[0]?.utcDate ?? null
}
