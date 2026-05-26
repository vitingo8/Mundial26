'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchWcMatchesClient } from '../lib/footballData'

const CACHE_KEY = 'porra_wc_matches'
const CACHE_TTL = 60 * 60 * 1000

function readCache() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
}

export function useWcMatches() {
  const [wcMatches, setWcMatches] = useState([])
  const [wcLoading, setWcLoading] = useState(true)
  const [apiError, setApiError] = useState(null)

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache()
      if (cached?.length) {
        setWcMatches(cached)
        setWcLoading(false)
        return cached
      }
    }
    setWcLoading(true)
    setApiError(null)
    try {
      const raw = await fetchWcMatchesClient()
      setWcMatches(raw)
      writeCache(raw)
      return raw
    } catch (e) {
      setApiError(e.message)
      const cached = readCache()
      if (cached?.length) setWcMatches(cached)
      return cached || []
    } finally {
      setWcLoading(false)
    }
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  return { wcMatches, setWcMatches, wcLoading, apiError, reload: () => load(true) }
}
