import { NextResponse } from 'next/server'
import { fetchFotmobSpecials } from '../../../../lib/fotmobSpecials.js'

export const dynamic = 'force-dynamic'

const CACHE = { value: null, at: 0 }
const CACHE_TTL_MS = 5 * 60 * 1000

export async function GET() {
  if (CACHE.value && Date.now() - CACHE.at < CACHE_TTL_MS) {
    return NextResponse.json(CACHE.value, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    })
  }

  try {
    const result = await fetchFotmobSpecials({ count: 20 })
    CACHE.value = result
    CACHE.at = Date.now()
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    })
  } catch (e) {
    return NextResponse.json(
      {
        scorers: { players: [], available: false },
        assists: { players: [], available: false },
        rating: { players: [], available: false },
        keepers: { players: [], available: false },
        error: e.message || 'fetch_failed',
      },
      { status: 502 },
    )
  }
}
