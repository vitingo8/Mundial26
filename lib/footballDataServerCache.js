import { footballDataFetch, WC_CODE } from './footballData.js'
import { enrichApiMatches } from './fifaMatchNumbers.js'
import { buildCatalogApiMatches } from './catalogApiMatches.js'

const CACHE_TTL_MS = 5 * 60 * 1000

/** @type {{ data: object | null; ts: number; key: string }} */
const matchesCache = { data: null, ts: 0, key: '' }

function catalogFallback(errorMessage) {
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
  const fresh = matchesCache.data && matchesCache.key === key && now - matchesCache.ts < CACHE_TTL_MS

  if (fresh) {
    return { ...matchesCache.data, _source: 'cache' }
  }

  try {
    const data = await footballDataFetch(`/competitions/${WC_CODE}/matches`, {
      season,
      status: searchParams.status || undefined,
      matchday: searchParams.matchday || undefined,
      stage: searchParams.stage || undefined,
    })

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
    const stale = matchesCache.data && matchesCache.key === key
    if (stale) {
      return { ...matchesCache.data, _source: 'stale', _error: e.message }
    }
    return catalogFallback(e.message)
  }
}
