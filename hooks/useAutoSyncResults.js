'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getStoredWriteToken } from '../lib/sessionToken'
import { buildMergedResults, resultsNeedSync, buildResultTimestamps, timestampsNeedSync } from '../lib/syncResultsFromApi'
import { updateGroupWithOptionalColumns } from '../lib/groupUpdateFallback'
import { isTestPorraGroup } from '../lib/testPorraGroups'

async function persistGroupUpdates(groupId, userId, token, updates) {
  if (token) {
    const res = await fetch('/api/groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, userId, token, updates }),
    })
    return res.ok
  }
  const { error } = await updateGroupWithOptionalColumns(supabase, groupId, updates)
  return !error
}

/**
 * Cuando la API tiene partidos finalizados, los persiste en porra_groups.results
 * sin intervención del organizador.
 */
export function useAutoSyncResults({
  enabled,
  group,
  setGroup,
  wcMatches,
  userId,
  refreshGroup,
}) {
  const busy = useRef(false)
  const lastSavedKey = useRef('')

  useEffect(() => {
    if (!enabled || !group?.id || isTestPorraGroup(group.id) || !wcMatches?.length) return

    const merged = buildMergedResults(wcMatches, group.results)
    const needsResults = resultsNeedSync(group.results, merged)
    const needsTimestamps = timestampsNeedSync(group.results, group.results_updated_at, merged)
    const syncKey = JSON.stringify({ merged, needsResults, needsTimestamps })
    if (syncKey === lastSavedKey.current) return
    if (!needsResults && !needsTimestamps) {
      lastSavedKey.current = syncKey
      return
    }

    let cancelled = false

    ;(async () => {
      if (busy.current) return
      busy.current = true
      try {
        const resultsUpdatedAt = buildResultTimestamps(group.results, group.results_updated_at, merged)
        const ok = await persistGroupUpdates(group.id, userId, getStoredWriteToken(group.id, userId), {
          ...(needsResults ? { results: merged } : {}),
          results_updated_at: resultsUpdatedAt,
        })
        if (!cancelled && ok) {
          lastSavedKey.current = syncKey
          const updated = await refreshGroup?.(group.id)
          if (updated) setGroup(updated)
        }
      } finally {
        busy.current = false
      }
    })()

    return () => { cancelled = true }
  }, [enabled, wcMatches, group?.id, group?.results, group?.results_updated_at, userId, setGroup, refreshGroup])
}
