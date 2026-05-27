import groupStageCatalog from './fifaMatchCatalog/groupStage.json' with { type: 'json' }
import { isDeadlinePassed } from './gameData'

let cachedFirstGroupKickoff = null

/** Pitido del primer partido de la fase de grupos (catálogo FIFA 2026). */
export function getFirstGroupStageKickoff() {
  if (!cachedFirstGroupKickoff) {
    const dates = groupStageCatalog
      .filter(r => r.utcDate)
      .map(r => r.utcDate)
      .sort()
    cachedFirstGroupKickoff = dates[0] || null
  }
  return cachedFirstGroupKickoff
}

export function getDefaultGroupDeadline() {
  return getFirstGroupStageKickoff()
}

/** Plazo de Inicio: el configurado en el grupo o el primer partido de grupos. */
export function getEffectiveGroupDeadline(group) {
  return group?.group_deadline || getDefaultGroupDeadline()
}

export function isGroupDeadlinePassed(group) {
  return isDeadlinePassed(getEffectiveGroupDeadline(group))
}

/** Bloqueo al pitido (hora UTC del partido). */
export function isMatchKickoffPassed(utcDate, now = new Date()) {
  if (!utcDate) return false
  const kickoff = new Date(utcDate).getTime()
  if (Number.isNaN(kickoff)) return false
  return now.getTime() >= kickoff
}

export function isKnockoutMatchEditable(utcDate, group) {
  if (group?.knockout_deadline && isDeadlinePassed(group.knockout_deadline)) return false
  return !isMatchKickoffPassed(utcDate)
}

export function isKnockoutPhaseFullyLocked(knockoutMatches = [], group) {
  if (group?.knockout_deadline && isDeadlinePassed(group.knockout_deadline)) return true
  if (!knockoutMatches.length) return false
  return knockoutMatches.every(m => isMatchKickoffPassed(m.utcDate))
}

/** Próximo pitido que cerrará un partido aún editable. */
export function getNextKnockoutLockKickoff(knockoutMatches = [], now = new Date()) {
  const t = now.getTime()
  const upcoming = knockoutMatches
    .filter(m => m.utcDate && new Date(m.utcDate).getTime() > t)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
  return upcoming[0]?.utcDate ?? null
}

export function isMatchPredictionLocked({ utcDate, phase, group, globalLocked = false }) {
  if (globalLocked) return true
  if (phase === 'knockout') {
    return !isKnockoutMatchEditable(utcDate, group)
  }
  return isGroupDeadlinePassed(group)
}
