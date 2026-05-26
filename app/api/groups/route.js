import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWriteToken } from '../../../lib/sessionToken'

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

    const { error } = await supabase.from('porra_groups').update(updates).eq('id', groupId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
