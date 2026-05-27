'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getStoredWriteToken } from '../lib/sessionToken'
import { buildMergedResults, resultsNeedSync } from '../lib/syncResultsFromApi'
import { isTestPorraGroup } from '../lib/testPorraGroups'

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
    const key = JSON.stringify(merged)
    if (key === lastSavedKey.current) return
    if (!resultsNeedSync(group.results, merged)) {
      lastSavedKey.current = key
      return
    }

    let cancelled = false

    ;(async () => {
      if (busy.current) return
      busy.current = true
      try {
        const updates = { results: merged }
        const token = getStoredWriteToken(group.id, userId)
        let ok = false
        if (token) {
          const res = await fetch('/api/groups', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId: group.id, userId, token, updates }),
          })
          ok = res.ok
        } else {
          const { error } = await supabase
            .from('porra_groups')
            .update(updates)
            .eq('id', group.id)
          ok = !error
        }
        if (!cancelled && ok) {
          lastSavedKey.current = key
          const updated = await refreshGroup?.(group.id)
          if (updated) setGroup(updated)
        }
      } finally {
        busy.current = false
      }
    })()

    return () => { cancelled = true }
  }, [enabled, wcMatches, group?.id, group?.results, userId, setGroup, refreshGroup])
}
