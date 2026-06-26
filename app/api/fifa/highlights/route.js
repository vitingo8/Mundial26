import { NextResponse } from 'next/server'
import {
  buildFifaHighlightsPagePath,
  FIFA_CXM_PAGES_API,
  FIFA_WC26_BASE,
} from '../../../../lib/fifaHighlights.js'
import { findEmbeddableHighlights } from '../../../../lib/youtubeHighlights.js'
import { findFifaWatchUrl } from '../../../../lib/fifaWatchUrl.js'

export const dynamic = 'force-dynamic'

const CACHE = new Map()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
/** Si aún no hay vídeo embebible, reintentar antes (suele tardar en subirse). */
const CACHE_TTL_NO_VIDEO_MS = 30 * 60 * 1000
/** Incrementar al cambiar la lógica de selección de YouTube (invalida caché en caliente). */
const CACHE_KEY_VERSION = 'v7'

function cacheGet(key) {
  const hit = CACHE.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > hit.ttl) {
    CACHE.delete(key)
    return null
  }
  return hit.value
}

function cacheSet(key, value, ttl = CACHE_TTL_MS) {
  CACHE.set(key, { at: Date.now(), value, ttl })
}

function youtubeThumbnail(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function buildYoutubeOnlyPayload(youtube) {
  return {
    available: true,
    title: youtube.title || null,
    thumbnail: youtubeThumbnail(youtube.videoId),
    urlEs: null,
    urlEn: null,
    watchUrl: null,
    youtubeId: youtube.videoId,
    youtubeTitle: youtube.title || null,
    youtubeChannel: youtube.channel || null,
  }
}

async function fetchFifaHighlightsPage(home, away) {
  const pagePath = buildFifaHighlightsPagePath(home, away)
  const cacheKey = pagePath ? `${CACHE_KEY_VERSION}:${pagePath}` : `${CACHE_KEY_VERSION}:${home}|${away}`

  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const youtubePromise = findEmbeddableHighlights(home, away).catch(() => null)

  if (!pagePath) {
    const youtube = await youtubePromise
    if (!youtube) {
      const miss = { available: false, reason: 'invalid_teams' }
      cacheSet(cacheKey, miss, CACHE_TTL_NO_VIDEO_MS)
      return miss
    }
    const payload = buildYoutubeOnlyPayload(youtube)
    cacheSet(cacheKey, payload)
    return payload
  }

  const apiUrl = `${FIFA_CXM_PAGES_API}${pagePath}`
  const fifaPromise = fetch(apiUrl, {
    headers: { 'User-Agent': 'Mundial26/1.0' },
    next: { revalidate: 3600 },
  })

  const [fifaRes, youtube] = await Promise.all([fifaPromise, youtubePromise])

  if (fifaRes.status === 404) {
    if (youtube) {
      const payload = buildYoutubeOnlyPayload(youtube)
      cacheSet(cacheKey, payload)
      return payload
    }
    const miss = { available: false, reason: 'not_published' }
    cacheSet(cacheKey, miss, CACHE_TTL_NO_VIDEO_MS)
    return miss
  }

  if (!fifaRes.ok) {
    if (youtube) {
      const payload = buildYoutubeOnlyPayload(youtube)
      cacheSet(cacheKey, payload, CACHE_TTL_MS)
      return payload
    }
    return { available: false, reason: 'upstream_error' }
  }

  const data = await fifaRes.json()
  const esPath = data?.relativeUrlsSEO?.es || null
  const enPath = data?.relativeUrl || pagePath

  let watchUrl = null
  try {
    watchUrl = await findFifaWatchUrl(`${FIFA_WC26_BASE}${enPath}`)
  } catch {
    // sin watch URL se usa el artículo
  }

  const payload = {
    available: true,
    title: data?.meta?.title || youtube?.title || null,
    thumbnail: data?.meta?.image || (youtube ? youtubeThumbnail(youtube.videoId) : null),
    urlEs: esPath ? `${FIFA_WC26_BASE}${esPath}` : null,
    urlEn: `${FIFA_WC26_BASE}${enPath}`,
    watchUrl,
    youtubeId: youtube?.videoId || null,
    youtubeTitle: youtube?.title || null,
    youtubeChannel: youtube?.channel || null,
  }
  cacheSet(cacheKey, payload, youtube ? CACHE_TTL_MS : CACHE_TTL_NO_VIDEO_MS)
  return payload
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const home = searchParams.get('home')?.trim()
  const away = searchParams.get('away')?.trim()

  if (!home || !away) {
    return NextResponse.json({ error: 'home y away requeridos' }, { status: 400 })
  }

  try {
    const result = await fetchFifaHighlightsPage(home, away)
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
    })
  } catch (e) {
    return NextResponse.json(
      { available: false, reason: 'fetch_failed', message: e.message },
      { status: 502 },
    )
  }
}
