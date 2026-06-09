'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWcResource } from '../lib/footballData'

const CACHE_KEY = 'porra_wc_matches'
const CACHE_TTL = 6 * 60 * 60 * 1000

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
  const wcMatchesRef = useRef([])
  wcMatchesRef.current = wcMatches

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache()
      if (cached?.length) {
        setWcMatches(cached)
        setWcLoading(false)
        return cached
      }
    }
    const hadMatches = wcMatchesRef.current.length > 0
    if (!hadMatches) setWcLoading(true)
    setApiError(null)
    try {
      const data = await fetchWcResource('matches')
      const raw = data.matches || []
      if (!raw.length) {
        throw new Error('El calendario llegó vacío')
      }
      setWcMatches(raw)
      writeCache(raw)
      if (data._source === 'catalog' || data._source === 'stale') {
        setApiError(
          data._source === 'stale'
            ? 'Calendario en caché (API temporalmente no disponible)'
            : 'Calendario provisional (API no disponible)',
        )
      }
      return raw
    } catch (e) {
      setApiError(e.message)
      const cached = readCache()
      if (cached?.length) {
        setWcMatches(cached)
        setApiError('Usando calendario guardado en el dispositivo')
      }
      return cached || []
    } finally {
      setWcLoading(false)
    }
  }, [])

  const reload = useCallback(() => load(true), [load])

  useEffect(() => {
    load(false)
  }, [load])

  return { wcMatches, setWcMatches, wcLoading, apiError, reload }
}
