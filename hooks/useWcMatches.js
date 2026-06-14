'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { fetchWcResource } from '../lib/footballData'
import {
  getWcMatchesPollIntervalMs,
  hasLiveWcMatches,
} from '../lib/wcMatchesRefresh'

const CACHE_KEY = 'porra_wc_matches'
const CACHE_TTL_LIVE = 10 * 1000
const CACHE_TTL_IDLE = 10 * 60 * 1000

const WcMatchesContext = createContext(null)

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
    live: hasLiveWcMatches(data),
  }))
}

/**
 * Proveedor único de partidos del Mundial: refresco adaptativo en segundo plano
 * (pausa con la pestaña oculta; reanuda al volver).
 */
export function WcMatchesProvider({ children }) {
  const [wcMatches, setWcMatches] = useState([])
  const [wcLoading, setWcLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const wcMatchesRef = useRef([])
  const loadInFlight = useRef(null)
  wcMatchesRef.current = wcMatches

  const load = useCallback(async (force = false) => {
    if (loadInFlight.current) {
      return loadInFlight.current
    }

    const run = (async () => {
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
    })()

    loadInFlight.current = run
    try {
      return await run
    } finally {
      if (loadInFlight.current === run) loadInFlight.current = null
    }
  }, [])

  const reload = useCallback(() => load(true), [load])

  useEffect(() => {
    load(false)
  }, [load])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    let cancelled = false
    let timeoutId = null

    function isVisible() {
      return document.visibilityState === 'visible'
    }

    function scheduleNext(delayMs) {
      if (cancelled) return
      clearTimeout(timeoutId)
      const interval = delayMs ?? getWcMatchesPollIntervalMs(wcMatchesRef.current, {
        visible: isVisible(),
      })
      if (interval == null) return
      timeoutId = setTimeout(async () => {
        if (!isVisible()) {
          scheduleNext()
          return
        }
        await load(true)
        scheduleNext()
      }, interval)
    }

    function refreshNow() {
      if (!isVisible()) return
      clearTimeout(timeoutId)
      void load(true).finally(() => scheduleNext())
    }

    function onVisibilityChange() {
      if (isVisible()) refreshNow()
      else clearTimeout(timeoutId)
    }

    function onPageShow(e) {
      if (e.persisted) refreshNow()
    }

    scheduleNext()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [load])

  const value = {
    wcMatches,
    setWcMatches,
    wcLoading,
    apiError,
    reload,
    hasLive: hasLiveWcMatches(wcMatches),
  }

  return (
    <WcMatchesContext.Provider value={value}>
      {children}
    </WcMatchesContext.Provider>
  )
}

export function useWcMatches() {
  const ctx = useContext(WcMatchesContext)
  if (!ctx) {
    throw new Error('useWcMatches debe usarse dentro de WcMatchesProvider')
  }
  return ctx
}
