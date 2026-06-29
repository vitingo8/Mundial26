'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { findParticipantsByEmail, hasMultiplePorraGroups } from '../lib/participantLookup'
import { F, perfMark } from '../lib/startupPerf'

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
      perfMark(F.IDLE, 'useUserPorraGroups — tarea diferida (requestIdleCallback)')
      ;(async () => {
        try {
          const t0 = performance.now()
          const multi = await hasMultiplePorraGroups(supabase, email)
          perfMark(F.SUPABASE, 'hasMultiplePorraGroups', {
            duracion_ms: Math.round(performance.now() - t0),
            varios_grupos: multi,
          })
          if (cancelled) return
          setHasMultiple(multi)
          if (!multi) {
            setGroups([])
            return
          }
          const t1 = performance.now()
          const all = await findParticipantsByEmail(supabase, email)
          perfMark(F.SUPABASE, 'findParticipantsByEmail', {
            duracion_ms: Math.round(performance.now() - t1),
            grupos_encontrados: all.length,
          })
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
