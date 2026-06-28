import { buildEliminatoriasKnockoutSchedule, lookupEliminatoriasKoPred } from './knockoutBridge.js'
import { isEliminatoriasMatchLocked } from './eliminatoriasMatchLock.js'
import {
  needsKnockoutAdvancePick,
  resolveKnockoutAdvanceSide,
} from './knockoutAdvances.js'

function isScoreFilled(val) {
  return val !== '' && val != null && !Number.isNaN(Number(val))
}

export const ELIMINATORIAS_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000

const DISMISS_STORAGE_KEY = 'porra_elim_reminder_dismissed'

/** Predicción completa de eliminatorias: marcador + quién pasa si hay empate. */
export function isEliminatoriasPredComplete(pred) {
  if (!pred || !isScoreFilled(pred.home) || !isScoreFilled(pred.away)) return false
  if (needsKnockoutAdvancePick(pred) && !resolveKnockoutAdvanceSide(pred)) return false
  return true
}

/**
 * Dieciseisavos+ con pitido en menos de 24 h y predicción de eliminatorias incompleta.
 */
export function getEliminatoriasReminderMatches(
  {
    knockoutMatches = [],
    koPreds = {},
    fotmobStandings = null,
    groupMatches = [],
    apiMatches = [],
    dismissedIds = [],
    groupPhase = 'knockout',
    now = new Date(),
  } = {},
) {
  if (groupPhase === 'finished') return []

  const schedule = buildEliminatoriasKnockoutSchedule(knockoutMatches, koPreds, {
    fotmobStandings,
    groupMatches,
    apiMatches,
  })

  const nowMs = now.getTime()
  const dismissed = new Set((dismissedIds || []).map(String))
  const urgent = []

  for (const m of schedule) {
    if (!m.utcDate || !m.id) continue
    if (dismissed.has(String(m.id))) continue
    if (isEliminatoriasMatchLocked(m, { phaseLocked: false, now })) continue

    const kickoff = new Date(m.utcDate).getTime()
    if (Number.isNaN(kickoff)) continue

    const msUntil = kickoff - nowMs
    if (msUntil <= 0 || msUntil > ELIMINATORIAS_REMINDER_WINDOW_MS) continue

    const pred = lookupEliminatoriasKoPred(koPreds, m)
    if (isEliminatoriasPredComplete(pred)) continue

    urgent.push({ ...m, msUntil })
  }

  return urgent.sort((a, b) => a.msUntil - b.msUntil)
}

export function readElimReminderDismissed(groupId) {
  if (!groupId) return []
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    return Array.isArray(map[groupId]) ? map[groupId].map(String) : []
  } catch {
    return []
  }
}

export function writeElimReminderDismissed(groupId, ids) {
  if (!groupId) return
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[groupId] = ids.map(String)
    sessionStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // sessionStorage no disponible
  }
}
