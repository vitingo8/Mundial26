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
        const optaId = searchParams.get('optaId') || undefined
        if (!matchId || !playerId) {
          return NextResponse.json({ error: 'matchId y playerId requeridos' }, { status: 400 })
        }
        const result = await getFotmobPlayerHeatmap(matchId, playerId, { heatmapPubUrl, optaId })
        return NextResponse.json({
          svg: result?.circles || null,
          template: result?.template || null,
        })
      }
      case 'competition':
        return NextResponse.json({
          name: 'FIFA World Cup',
          code: 'WC',
          season: '2026',
          provider: 'live',
        })
      default:
        return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 })
    }
  } catch (e) {
    if (resource === 'matches') {
      return NextResponse.json(catalogMatchesFallback(e.message))
    }
    return NextResponse.json(
      { error: e.message || 'Error al consultar datos en vivo' },
      { status: 502 },
    )
  }
}
