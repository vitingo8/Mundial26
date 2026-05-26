import groupStageCatalog from './fifaMatchCatalog/groupStage.json' with { type: 'json' }
import { getKnockoutFifaCatalog } from './fifaMatchNumbers.js'

/** Duración máxima de seguimiento tras el pitido (90'+prórroga+margen). */
export const POST_MATCH_MINUTES = 130

/**
 * Los 104 pitidos del catálogo estático (fase de grupos + eliminatorias en código).
 * No llama a ninguna API externa.
 */
export function getWcCatalogKickoffs() {
  const group = groupStageCatalog
    .filter(r => r.utcDate)
    .map(r => ({ matchNumber: r.n, utcDate: r.utcDate }))
  const knockout = getKnockoutFifaCatalog().map(r => ({
    matchNumber: r.n,
    utcDate: r.utcDate,
  }))
  return [...group, ...knockout].sort(
    (a, b) => new Date(a.utcDate) - new Date(b.utcDate),
  )
}

/** Desde el pitido hasta POST_MATCH_MINUTES después (sin margen previo). */
export function isCatalogMatchSessionOpen(utcDate, now = new Date()) {
  if (!utcDate) return false
  const kickoff = new Date(utcDate).getTime()
  if (Number.isNaN(kickoff)) return false
  const t = now.getTime()
  const post = POST_MATCH_MINUTES * 60 * 1000
  return t >= kickoff && t <= kickoff + post
}

/** ¿Debe el cron de GitHub llamar a football-data.org ahora? */
export function shouldWakeSyncFromCatalog(now = new Date()) {
  return getWcCatalogKickoffs().some(k => isCatalogMatchSessionOpen(k.utcDate, now))
}

export function getActiveCatalogSessions(now = new Date()) {
  return getWcCatalogKickoffs().filter(k => isCatalogMatchSessionOpen(k.utcDate, now))
}
