import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWriteToken } from '../../../lib/sessionToken'
import { stampPredictionsOnSave } from '../../../lib/predictionTimestamps'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase no configurado')
  return createClient(url, key)
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { groupId, userId, token, predictions } = body
    if (!groupId || !userId || !predictions) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const valid = await verifyWriteToken(token, groupId, userId)
    if (!valid) {
      return NextResponse.json({ error: 'Token no válido' }, { status: 403 })
    }

    const supabase = getAdmin()
    const { data: row } = await supabase
      .from('porra_participants')
      .select('id, group_id, predictions')
      .eq('id', userId)
      .single()

    if (!row || row.group_id !== groupId) {
      return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 })
    }

    const stamped = stampPredictionsOnSave(predictions, row.predictions)

    const { error } = await supabase
      .from('porra_participants')
      .update({ predictions: stamped, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
