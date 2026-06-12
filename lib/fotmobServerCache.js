import {
  applyLiveOverlay,
  fetchFotmobFixtures,
  fetchFotmobDayMatches,
  fetchFotmobMatchDetail,
  fetchFotmobMatchScore,
  formatFotmobDateYmd,
  fotmobFetch,
  mergeLiveDayScores,
  seedPageUrlIndex,
  transformFotmobFixtures,
  transformFotmobListMatch,
} from './fotmob.js'
import { enrichApiMatches } from './fifaMatchNumbers.js'
import { buildCatalogApiMatches } from './catalogApiMatches.js'
import { resolveHeatmapPubUrl } from './playerMatchStats.js'

const CACHE_TTL_LIVE_MS = 12_000
const CACHE_TTL_IDLE_MS = 5 * 60 * 1000
const DETAIL_PAGE_TTL_LIVE_MS = 15_000
const STALE_MAX_MS = 48 * 60 * 60 * 1000

/** @type {{ data: object | null; ts: number; hasLive: boolean }} */
const matchesCache = { data: null, ts: 0, hasLive: false }

/** @type {Map<string, { data: object; ts: number }>} */
const detailCache = new Map()

export function catalogMatchesFallback(errorMessage) {
  return {
    matches: enrichApiMatches(buildCatalogApiMatches()),
    _source: 'catalog',
    _error: errorMessage || undefined,
  }
}

function anyLiveMatch(matches) {
  return (matches || []).some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')
}

export async function fetchWcMatchesCached() {
  const now = Date.now()
  const cacheAge = matchesCache.data ? now - matchesCache.ts : Infinity
  const ttl = matchesCache.hasLive ? CACHE_TTL_LIVE_MS : CACHE_TTL_IDLE_MS

  if (matchesCache.data && cacheAge < ttl) {
    return { ...matchesCache.data, _source: 'cache' }
  }

  try {
    const { matches: raw, hasOngoingMatch } = await fetchFotmobFixtures()
    seedPageUrlIndex(raw)

    let normalized = transformFotmobFixtures(raw)

    if (hasOngoingMatch || normalized.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')) {
      const today = formatFotmobDateYmd(new Date())
      try {
        const day = await fetchFotmobDayMatches(today)
        const merged = mergeLiveDayScores(raw, day)
        normalized = transformFotmobFixtures(merged)
      } catch {
        // calendario completo sigue siendo válido
      }
    }

    const enriched = {
      matches: enrichApiMatches(normalized),
      _source: 'fotmob',
    }
    matchesCache.data = enriched
    matchesCache.ts = now
    matchesCache.hasLive = hasOngoingMatch || anyLiveMatch(enriched.matches)
    return enriched
  } catch (e) {
    const stale = matchesCache.data && cacheAge < STALE_MAX_MS
    if (stale) {
      return { ...matchesCache.data, _source: 'stale', _error: e.message }
    }
    return catalogMatchesFallback(e.message)
  }
}

export async function getWcMatchesSafe() {
  try {
    return await fetchWcMatchesCached()
  } catch (e) {
    return catalogMatchesFallback(e.message)
  }
}

async function fetchLiveSnapshot(matchId) {
  try {
    const raw = await fetchFotmobMatchScore(matchId)
    return raw ? transformFotmobListMatch(raw) : null
  } catch {
    return null
  }
}

export async function getFotmobMatchDetail(matchId, options = {}) {
  const { force = false } = options
  const key = String(matchId)
  const now = Date.now()

  if (force) detailCache.delete(key)

  const liveSnap = await fetchLiveSnapshot(key)
  const isLive = liveSnap && (liveSnap.status === 'IN_PLAY' || liveSnap.status === 'PAUSED')

  const cached = detailCache.get(key)
  const pageTtl = isLive ? DETAIL_PAGE_TTL_LIVE_MS : CACHE_TTL_IDLE_MS
  let detail = null
  let pageSource = 'fotmob'

  if (!force && cached?.data && now - cached.ts < pageTtl) {
    detail = cached.data
    pageSource = 'cache'
  } else {
    try {
      detail = await fetchFotmobMatchDetail(key)
      detailCache.set(key, { data: detail, ts: now })
    } catch (e) {
      if (cached?.data) {
        detail = cached.data
        pageSource = 'stale'
      } else if (liveSnap) {
        detail = liveSnap
        pageSource = 'fotmob-score'
      } else {
        throw e
      }
    }
  }

  if (liveSnap) {
    detail = applyLiveOverlay(detail, liveSnap)
    pageSource = isLive ? 'fotmob-live' : pageSource
  }

  return { ...detail, _source: pageSource }
}

export function invalidateLiveCaches() {
  matchesCache.ts = 0
  detailCache.clear()
}

export function invalidateMatchDetailCache(matchId) {
  detailCache.delete(String(matchId))
}

/** @type {Map<string, { players: object; ts: number }>} */
const heatmapCache = new Map()

/** SVG circles del heatmap de un jugador (FotMob). */
export async function getFotmobPlayerHeatmap(matchId, playerId, options = {}) {
  const key = String(matchId)
  const pid = String(playerId)
  let players = heatmapCache.get(key)?.players

  if (!players) {
    let pubUrl = options.heatmapPubUrl || null
    if (!pubUrl) {
      try {
        const detail = await getFotmobMatchDetail(key)
        pubUrl = detail?.heatmapPubUrl || null
      } catch {
        // seguir con URL por defecto
      }
    }
    pubUrl = pubUrl || resolveHeatmapPubUrl(null, key)

    try {
      const data = await fotmobFetch(`/api/data/heatmap/match/${key}/heatmaps`, {
        heatmapUrl: pubUrl,
      })
      players = data?.players
      if (players) heatmapCache.set(key, { players, ts: Date.now() })
    } catch {
      return null
    }
  }

  if (!players) return null
  return players[`p${pid}`] || players[pid] || null
}
