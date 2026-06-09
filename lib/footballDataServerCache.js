import { footballDataFetch, WC_CODE } from './footballData.js'
import { enrichApiMatches } from './fifaMatchNumbers.js'
import { buildCatalogApiMatches } from './catalogApiMatches.js'

const CACHE_TTL_MS = 30 * 60 * 1000
const STALE_MAX_MS = 48 * 60 * 60 * 1000

/** @type {{ data: object | null; ts: number; key: string }} */
const matchesCache = { data: null, ts: 0, key: '' }

export function catalogMatchesFallback(errorMessage) {
  return {
    matches: enrichApiMatches(buildCatalogApiMatches()),
    _source: 'catalog',
    _error: errorMessage || undefined,
  }
}

/**
 * Partidos WC con caché en servidor, reintento con datos antiguos y fallback al catálogo estático.
 * Evita pantallas vacías cuando football-data.org devuelve 429 u otros errores transitorios.
 */
export async function fetchWcMatchesCached(searchParams = {}) {
  const season = searchParams.season || '2026'
  const key = `matches:${season}`
  const now = Date.now()
  const cacheAge = matchesCache.data && matchesCache.key === key ? now - matchesCache.ts : Infinity
  const fresh = cacheAge < CACHE_TTL_MS

  if (fresh) {
    return { ...matchesCache.data, _source: 'cache' }
  }

  try {
    const data = await footballDataFetch(
      `/competitions/${WC_CODE}/matches`,
      {
        season,
        status: searchParams.status || undefined,
        matchday: searchParams.matchday || undefined,
        stage: searchParams.stage || undefined,
      },
      { timeoutMs: 6000, retries: 1 },
    )

    if (!Array.isArray(data?.matches) || data.matches.length === 0) {
      throw new Error('football-data.org no devolvió partidos')
    }

    const enriched = {
      ...data,
      matches: enrichApiMatches(data.matches),
      _source: 'api',
    }
    matchesCache.data = enriched
    matchesCache.ts = now
    matchesCache.key = key
    return enriched
  } catch (e) {
    const stale = matchesCache.data && matchesCache.key === key && cacheAge < STALE_MAX_MS
    if (stale) {
      return { ...matchesCache.data, _source: 'stale', _error: e.message }
    }
    return catalogMatchesFallback(e.message)
  }
}

/** Nunca lanza: respuesta segura para /api/football?resource=matches */
export async function getWcMatchesSafe(searchParams = {}) {
  try {
    return await fetchWcMatchesCached(searchParams)
  } catch (e) {
    return catalogMatchesFallback(e.message)
  }
}
