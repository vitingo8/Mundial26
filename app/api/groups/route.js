import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWriteToken } from '../../../lib/sessionToken'
import { normalizeLogoDataUrl } from '../../../lib/participantProfile'
import { isMissingDbColumn, updateGroupWithOptionalColumns } from '../../../lib/groupUpdateFallback'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase no configurado')
  return createClient(url, key)
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { groupId, userId, token, updates } = body
    if (!groupId || !userId || !updates) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const valid = await verifyWriteToken(token, groupId, userId)
    if (!valid) {
      return NextResponse.json({ error: 'Token no válido' }, { status: 403 })
    }

    const supabase = getAdmin()
    const { data: group } = await supabase.from('porra_groups').select('admin_id').eq('id', groupId).single()
    if (!group || group.admin_id !== userId) {
      return NextResponse.json({ error: 'Solo el organizador puede actualizar el grupo' }, { status: 403 })
    }

    const patch = { ...updates }
    if (patch.league_logo !== undefined) {
      try {
        patch.league_logo = normalizeLogoDataUrl(patch.league_logo)
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
    }

    const { error, dropped } = await updateGroupWithOptionalColumns(supabase, groupId, patch)
    if (error) {
      const missingLeagueLogo =
        isMissingDbColumn(error, 'league_logo') && patch.league_logo !== undefined
      if (missingLeagueLogo) {
        return NextResponse.json(
          {
            error:
              'Falta la columna league_logo en la base de datos. Ejecuta en Supabase → SQL Editor: ALTER TABLE porra_groups ADD COLUMN IF NOT EXISTS league_logo TEXT;',
          },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      ...(dropped?.includes('results_updated_at')
        ? { warning: 'results_updated_at no disponible; resultados guardados sin marca de tiempo' }
        : {}),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
