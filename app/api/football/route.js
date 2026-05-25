import { NextResponse } from 'next/server'
import { footballDataFetch, WC_CODE } from '../../../lib/footballData'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const resource = searchParams.get('resource') || 'matches'

  try {
    let data
    switch (resource) {
      case 'matches':
        data = await footballDataFetch(`/competitions/${WC_CODE}/matches`, {
          season: searchParams.get('season') || '2026',
          status: searchParams.get('status') || undefined,
          matchday: searchParams.get('matchday') || undefined,
          stage: searchParams.get('stage') || undefined,
        })
        break
      case 'teams':
        data = await footballDataFetch(`/competitions/${WC_CODE}/teams`, {
          season: searchParams.get('season') || '2026',
        })
        break
      case 'standings':
        data = await footballDataFetch(`/competitions/${WC_CODE}/standings`, {
          season: searchParams.get('season') || '2026',
        })
        break
      case 'competition':
        data = await footballDataFetch(`/competitions/${WC_CODE}`)
        break
      default:
        return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 })
    }
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Error al consultar football-data.org' },
      { status: 502 }
    )
  }
}
