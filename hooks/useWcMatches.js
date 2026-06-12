'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWcResource } from '../lib/footballData'

const CACHE_KEY = 'porra_wc_matches'
const CACHE_TTL_LIVE = 10 * 1000
const CACHE_TTL_IDLE = 10 * 60 * 1000

function hasLiveMatches(list) {
  return (list || []).some(m => ['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status))
}

function readCache() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data, live } = JSON.parse(raw)
    const ttl = live ? CACHE_TTL_LIVE : CACHE_TTL_IDLE
    if (Date.now() - ts > ttl) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({
    ts: Date.now(),
    data,
    live: hasLiveMatches(data),
  }))
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
      const data = await fetchWcResource('matches', force ? { force: '1' } : {})
      const raw = data.matches || []
      if (!raw.length) {
        throw new Error('El calendario llegó vacío')
      }
      setWcMatches(raw)
      writeCache(raw)
      if (data._source === 'catalog' || data._source === 'stale') {
        setApiError(
          data._source === 'stale'
            ? 'Calendario en caché (fuente en vivo temporalmente no disponible)'
            : 'Calendario provisional (fuente en vivo no disponible)',
        )
      } else if (data._source === 'fotmob' || data._source === 'cache') {
        setApiError(null)
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

  useEffect(() => {
    if (!hasLiveMatches(wcMatches)) return
    const t = setInterval(() => load(true), 10_000)
    return () => clearInterval(t)
  }, [wcMatches, load])

  return { wcMatches, setWcMatches, wcLoading, apiError, reload, hasLive: hasLiveMatches(wcMatches) }
}
