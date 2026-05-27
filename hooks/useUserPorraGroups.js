'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { findParticipantsByEmail } from '../lib/participantLookup'

/** Grupos en los que participa el usuario (mismo email). */
export function useUserPorraGroups(email) {
  const [groups, setGroups] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!email) {
      setGroups([])
      return
    }
    setGroups(null)
    ;(async () => {
      try {
        const all = await findParticipantsByEmail(supabase, email)
        if (!cancelled) setGroups(all)
      } catch {
        if (!cancelled) setGroups([])
      }
    })()
    return () => { cancelled = true }
  }, [email])

  return {
    groups: groups ?? [],
    loading: groups === null,
    hasMultiple: groups !== null && groups.length > 1,
  }
}
