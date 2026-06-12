import { NextResponse } from 'next/server'
import {
  buildFifaHighlightsPagePath,
  FIFA_CXM_PAGES_API,
  FIFA_WC26_BASE,
} from '../../../../lib/fifaHighlights.js'
import { findEmbeddableHighlights } from '../../../../lib/youtubeHighlights.js'

export const dynamic = 'force-dynamic'

const CACHE = new Map()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
/** Si aún no hay vídeo embebible, reintentar antes (suele tardar en subirse). */
const CACHE_TTL_NO_VIDEO_MS = 30 * 60 * 1000

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

async function fetchFifaHighlightsPage(home, away) {
  const pagePath = buildFifaHighlightsPagePath(home, away)
  if (!pagePath) {
    return { available: false, reason: 'invalid_teams' }
  }

  const cacheKey = pagePath
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const apiUrl = `${FIFA_CXM_PAGES_API}${pagePath}`
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Mundial26/1.0' },
    next: { revalidate: 3600 },
  })

  if (res.status === 404) {
    const miss = { available: false, reason: 'not_published' }
    cacheSet(cacheKey, miss)
    return miss
  }

  if (!res.ok) {
    return { available: false, reason: 'upstream_error' }
  }

  const data = await res.json()
  const esPath = data?.relativeUrlsSEO?.es || null
  const enPath = data?.relativeUrl || pagePath

  let youtube = null
  try {
    youtube = await findEmbeddableHighlights(home, away)
  } catch {
    // sin YouTube se mantiene el fallback a FIFA.com
  }

  const payload = {
    available: true,
    title: data?.meta?.title || null,
    thumbnail: data?.meta?.image || null,
    urlEs: esPath ? `${FIFA_WC26_BASE}${esPath}` : null,
    urlEn: `${FIFA_WC26_BASE}${enPath}`,
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
