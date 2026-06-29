'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { findParticipantsByEmail, hasMultiplePorraGroups } from '../lib/participantLookup'

function defer(fn) {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(fn, { timeout: 1500 })
  }
  return setTimeout(fn, 0)
}

function cancelDefer(id) {
  if (typeof cancelIdleCallback !== 'undefined' && typeof requestIdleCallback !== 'undefined') {
    cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

/** Grupos en los que participa el usuario (mismo email). Carga diferida para no bloquear el arranque. */
export function useUserPorraGroups(email) {
  const [groups, setGroups] = useState([])
  const [hasMultiple, setHasMultiple] = useState(false)
  const [loading, setLoading] = useState(Boolean(email))

  useEffect(() => {
    let cancelled = false
    if (!email) {
      setGroups([])
      setHasMultiple(false)
      setLoading(false)
      return undefined
    }

    setLoading(true)

    const taskId = defer(() => {
      ;(async () => {
        try {
          const multi = await hasMultiplePorraGroups(supabase, email)
          if (cancelled) return
          setHasMultiple(multi)
          if (!multi) {
            setGroups([])
            return
          }
          const all = await findParticipantsByEmail(supabase, email)
          if (!cancelled) setGroups(all)
        } catch {
          if (!cancelled) {
            setGroups([])
            setHasMultiple(false)
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    })

    return () => {
      cancelled = true
      cancelDefer(taskId)
    }
  }, [email])

  return {
    groups,
    loading,
    hasMultiple,
  }
}
