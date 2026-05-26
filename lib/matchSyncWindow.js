/**
 * @deprecated Usa wcKickoffCatalog.js (calendario estático). Reexporta por compatibilidad.
 */
export {
  POST_MATCH_MINUTES,
  isCatalogMatchSessionOpen as isMatchInSyncWindow,
  shouldWakeSyncFromCatalog as shouldSyncMatchesNow,
  getActiveCatalogSessions as activeSyncMatches,
} from './wcKickoffCatalog.js'
