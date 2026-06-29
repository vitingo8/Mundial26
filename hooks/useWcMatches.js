'use client'

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { fetchWcResource } from '../lib/footballData'
import { enrichApiMatches } from '../lib/fifaMatchNumbers.js'
import { buildCatalogApiMatches } from '../lib/catalogApiMatches.js'
import { teamCrestUrl } from '../lib/mediaUrls.js'
import {
  getWcMatchesPollIntervalMs,
  hasLiveWcMatches,
} from '../lib/wcMatchesRefresh'
import { F, perfMark, perfSync } from '../lib/startupPerf'

const CACHE_KEY = 'porra_wc_matches_v2'
const CACHE_TTL_LIVE = 10 * 1000
const CACHE_TTL_IDLE = 10 * 60 * 1000

const WcMatchesContext = createContext(null)

let catalogMatchesMemo = null

function isLiveMatchSet(matches) {
  return (matches || []).some(m => /^\d+$/.test(String(m.id)))
}

/** Calendario en vivo exige standings de FotMob en caché; el catálogo estático no. */
function cacheHasStandings(matches, standings) {
  if (!isLiveMatchSet(matches)) return true
  return Boolean(standings?.ready && standings?.byGroup)
}

function cacheIsComplete(cached) {
  if (!cached?.matches?.length) return false
  return cacheHasStandings(cached.matches, cached.standings)
}

function getCatalogMatches() {
  if (!catalogMatchesMemo) {
    catalogMatchesMemo = perfSync(F.MATCHES, 'Construir catálogo FIFA estático (104 partidos)', () =>
      enrichApiMatches(buildCatalogApiMatches()),
    )
  }
  return catalogMatchesMemo
}

function hydrateMatchCrests(matches) {
  if (!Array.isArray(matches)) return matches
  return matches.map(m => {
    const home = m.homeTeam
    const away = m.awayTeam
    if (!home?.crest && !away?.crest && !home?.id && !away?.id) return m
    return {
      ...m,
      homeTeam: home
        ? { ...home, crest: home.crest ?? teamCrestUrl(home.id) ?? null }
        : home,
      awayTeam: away
        ? { ...away, crest: away.crest ?? teamCrestUrl(away.id) ?? null }
        : away,
    }
  })
}

function readCache({ allowStale = false } = {}) {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data, standings, live } = JSON.parse(raw)
    if (!Array.isArray(data) || !data.length) return null
    const ttl = live ? CACHE_TTL_LIVE : CACHE_TTL_IDLE
    if (!allowStale && Date.now() - ts > ttl) return null
    return { matches: hydrateMatchCrests(data), standings: standings ?? null }
  } catch {
    return null
  }
}

function readInitialWcMatches() {
  const cached = readCache({ allowStale: true })
  if (cached?.matches?.length) return cached.matches
  return []
}

function deferCatalogBuild(setWcMatches) {
  const build = () => {
    perfMark(F.MATCHES, 'Idle callback — construyendo catálogo FIFA')
    startTransition(() => {
      setWcMatches(getCatalogMatches())
      perfMark(F.MATCHES, 'Catálogo FIFA aplicado al estado')
    })
  }
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(build, { timeout: 800 })
  } else {
    setTimeout(build, 0)
  }
}

function readBootstrapStandings() {
  const cached = readCache({ allowStale: true })
  return cached?.standings ?? null
}

function writeCache(data, standings = null) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({
    ts: Date.now(),
    data,
    standings,
    live: hasLiveWcMatches(data),
  }))
}

/**
 * Proveedor único de partidos del Mundial: refresco adaptativo en segundo plano
 * (pausa con la pestaña oculta; reanuda al volver).
 */
export function WcMatchesProvider({ children }) {
  const [wcMatches, setWcMatches] = useState(readInitialWcMatches)
  const [wcStandings, setWcStandings] = useState(readBootstrapStandings)
  const [apiError, setApiError] = useState(null)
  const wcMatchesRef = useRef([])
  const loadInFlight = useRef(null)
  wcMatchesRef.current = wcMatches

  useLayoutEffect(() => {
    perfMark(F.MATCHES, 'WcMatchesProvider — hidratación inicial')
    const cached = readCache({ allowStale: true })
    if (cached?.matches?.length) {
      perfMark(F.MATCHES, 'Partidos desde sessionStorage', {
        count: cached.matches.length,
        tiene_standings: Boolean(cached.standings?.ready),
      })
      setWcMatches(cached.matches)
      setWcStandings(cached.standings ?? null)
      return
    }
    perfMark(F.MATCHES, 'Sin caché de partidos — catálogo se construirá en idle')
    deferCatalogBuild(setWcMatches)
  }, [])

  const load = useCallback(async (force = false) => {
    if (loadInFlight.current) {
      return loadInFlight.current
    }

    const run = (async () => {
      if (!force) {
        const cached = readCache()
        if (cacheIsComplete(cached)) {
          perfMark(F.MATCHES, 'Fetch omitido — caché de partidos aún válida')
          setWcMatches(cached.matches)
          setWcStandings(cached.standings ?? null)
          return cached.matches
        }
        const stale = readCache({ allowStale: true })
        if (stale?.matches?.length) {
          perfMark(F.MATCHES, 'Mostrando caché antigua mientras se pide red', { count: stale.matches.length })
          setWcMatches(stale.matches)
          setWcStandings(stale.standings ?? null)
        }
      }
      setApiError(null)
      try {
        const t0 = performance.now()
        perfMark(F.MATCHES, `Petición HTTP calendario${force ? ' (forzada)' : ''} — inicio`)
        const data = await fetchWcResource('matches', force ? { force: '1' } : {})
        const fetchMs = Math.round(performance.now() - t0)
        const raw = data.matches || []
        if (!raw.length) {
          throw new Error('El calendario llegó vacío')
        }
        perfMark(F.MATCHES, 'Petición HTTP calendario — fin', {
          duracion_ms: fetchMs,
          fuente: data._source,
          partidos: raw.length,
        })
        startTransition(() => {
          setWcMatches(hydrateMatchCrests(raw))
          setWcStandings(data.standings ?? null)
        })
        writeCache(hydrateMatchCrests(raw), data.standings ?? null)
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
        const cached = readCache({ allowStale: true })
        if (cached?.matches?.length) {
          setWcMatches(cached.matches)
          setWcStandings(cached.standings ?? null)
          setApiError('Usando calendario guardado en el dispositivo')
        } else if (!wcMatchesRef.current.length) {
          setWcMatches(getCatalogMatches())
          setWcStandings(null)
        }
        return cached?.matches || wcMatchesRef.current
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
    perfMark(F.MATCHES, 'Programada carga inicial de partidos')
    void load(false).then(() => perfMark(F.MATCHES, 'Carga inicial de partidos terminada'))
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

    const bootDelay = getWcMatchesPollIntervalMs(wcMatchesRef.current, { visible: isVisible() }) ?? 60_000
    scheduleNext(bootDelay)
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
    wcStandings,
    setWcStandings,
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
