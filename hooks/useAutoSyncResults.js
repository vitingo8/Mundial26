'use client'
import { useEffect, useRef } from 'react'
import { isTestPorraGroup } from '../lib/testPorraGroups'
import { getStoredWriteToken } from '../lib/sessionToken'
import { buildMergedResults, resultsNeedSync, timestampsNeedSync } from '../lib/syncResultsFromApi'

async function syncResultsViaApi(groupId, userId, token) {
  const res = await fetch('/api/groups/sync-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, userId, token }),
  })
  return res.ok
}

/**
 * Cuando la API tiene partidos finalizados, los persiste en porra_groups.results
 * sin intervención del organizador. Cualquier participante con token de escritura
 * puede disparar la sincronización.
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

    const token = getStoredWriteToken(group.id, userId)
    if (!token) return

    let cancelled = false

    ;(async () => {
      if (busy.current) return
      busy.current = true
      try {
        const ok = await syncResultsViaApi(group.id, userId, token)
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
