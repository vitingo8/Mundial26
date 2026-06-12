import { NextResponse } from 'next/server'
import {
  catalogMatchesFallback,
  getFotmobMatchDetail,
  getFotmobPlayerHeatmap,
  getWcMatchesSafe,
  invalidateLiveCaches,
} from '../../../lib/fotmobServerCache'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const resource = searchParams.get('resource') || 'matches'
  const force = searchParams.get('force') === '1'

  try {
    if (force && resource === 'matches') invalidateLiveCaches()

    switch (resource) {
      case 'matches': {
        const data = await getWcMatchesSafe()
        if (!Array.isArray(data?.matches) || data.matches.length === 0) {
          return NextResponse.json(catalogMatchesFallback('respuesta vacía'))
        }
        return NextResponse.json(data)
      }
      case 'match': {
        const id = searchParams.get('id')
        if (!id) {
          return NextResponse.json({ error: 'id requerido' }, { status: 400 })
        }
        const data = await getFotmobMatchDetail(id, { force })
        return NextResponse.json(data)
      }
      case 'player-heatmap': {
        const matchId = searchParams.get('matchId')
        const playerId = searchParams.get('playerId')
        const heatmapPubUrl = searchParams.get('heatmapPubUrl') || undefined
        if (!matchId || !playerId) {
          return NextResponse.json({ error: 'matchId y playerId requeridos' }, { status: 400 })
        }
        const svg = await getFotmobPlayerHeatmap(matchId, playerId, { heatmapPubUrl })
        return NextResponse.json({ svg })
      }
      case 'competition':
        return NextResponse.json({
          name: 'FIFA World Cup',
          code: 'WC',
          season: '2026',
          provider: 'fotmob',
        })
      default:
        return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 })
    }
  } catch (e) {
    if (resource === 'matches') {
      return NextResponse.json(catalogMatchesFallback(e.message))
    }
    return NextResponse.json(
      { error: e.message || 'Error al consultar FotMob' },
      { status: 502 },
    )
  }
}
