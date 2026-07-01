import { createClient } from '@supabase/supabase-js'
import { getWcMatchesSafe } from './fotmobServerCache.js'
import { buildMergedResults, resultsNeedSync, buildResultTimestamps, timestampsNeedSync } from './syncResultsFromApi.js'
import { updateGroupWithOptionalColumns } from './groupUpdateFallback.js'
import {
  getActiveCatalogSessions,
  shouldWakeSyncFromCatalog,
} from './wcKickoffCatalog.js'
import { isTestPorraGroup } from './testPorraGroups.js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios')
  }
  return createClient(url, key)
}

/**
 * Sincroniza resultados FINISHED de la API a todos los grupos.
 * Sin `force`: solo si el calendario del código indica partido en curso (pitido → ~2h10).
 * No gasta peticiones fuera de esas ventanas.
 */
export async function syncAllGroupsFromApi(options = {}) {
  const { force = false, now = new Date() } = options

  if (!force && !shouldWakeSyncFromCatalog(now)) {
    return { skipped: true, reason: 'no_match_session' }
  }

  const activeCatalog = getActiveCatalogSessions(now)

  const data = await getWcMatchesSafe()
  const matches = data.matches || []

  const supabase = getAdminSupabase()
  const { data: groups, error: listErr } = await supabase
    .from('porra_groups')
    .select('id, results, results_updated_at')

  if (listErr) throw new Error(listErr.message)

  let updated = 0
  for (const group of groups || []) {
    if (isTestPorraGroup(group.id)) continue
    const merged = buildMergedResults(matches, group.results)
    const needsResults = resultsNeedSync(group.results, merged)
    const needsTimestamps = timestampsNeedSync(group.results, group.results_updated_at, merged)
    if (!needsResults && !needsTimestamps) continue
    const resultsUpdatedAt = buildResultTimestamps(group.results, group.results_updated_at, merged)
    const { error } = await updateGroupWithOptionalColumns(supabase, group.id, {
      ...(needsResults ? { results: merged } : {}),
      results_updated_at: resultsUpdatedAt,
    })
    if (error) throw new Error(`Grupo ${group.id}: ${error.message}`)
    updated += 1
  }

  return {
    skipped: false,
    groupsTotal: groups?.length ?? 0,
    groupsUpdated: updated,
    activeCatalog,
  }
}
