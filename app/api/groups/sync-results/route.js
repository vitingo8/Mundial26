import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWriteToken } from '../../../../lib/sessionToken'
import { getWcMatchesSafe } from '../../../../lib/fotmobServerCache'
import {
  buildMergedResults,
  resultsNeedSync,
  buildResultTimestamps,
  timestampsNeedSync,
} from '../../../../lib/syncResultsFromApi'
import { updateGroupWithOptionalColumns } from '../../../../lib/groupUpdateFallback'

export const dynamic = 'force-dynamic'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase no configurado')
  return createClient(url, key)
}

/** Sincroniza resultados FINISHED de la API en el grupo (cualquier participante con token). */
export async function POST(request) {
  try {
    const body = await request.json()
    const { groupId, userId, token } = body
    if (!groupId || !userId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const valid = await verifyWriteToken(token, groupId, userId)
    if (!valid) {
      return NextResponse.json({ error: 'Token no válido' }, { status: 403 })
    }

    const supabase = getAdmin()
    const { data: participant } = await supabase
      .from('porra_participants')
      .select('id')
      .eq('id', userId)
      .eq('group_id', groupId)
      .maybeSingle()
    if (!participant) {
      return NextResponse.json({ error: 'No perteneces a este grupo' }, { status: 403 })
    }

    const { data: group, error: gErr } = await supabase
      .from('porra_groups')
      .select('id, results, results_updated_at')
      .eq('id', groupId)
      .single()
    if (gErr || !group) {
      return NextResponse.json({ error: gErr?.message || 'Grupo no encontrado' }, { status: 404 })
    }

    const wcData = await getWcMatchesSafe()
    const merged = buildMergedResults(wcData?.matches || [], group.results)
    const needsResults = resultsNeedSync(group.results, merged)
    const needsTimestamps = timestampsNeedSync(group.results, group.results_updated_at, merged)
    if (!needsResults && !needsTimestamps) {
      return NextResponse.json({ ok: true, changed: false })
    }

    const resultsUpdatedAt = buildResultTimestamps(group.results, group.results_updated_at, merged)
    const { error } = await updateGroupWithOptionalColumns(supabase, groupId, {
      ...(needsResults ? { results: merged } : {}),
      results_updated_at: resultsUpdatedAt,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, changed: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
