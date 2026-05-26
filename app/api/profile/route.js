import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWriteToken } from '../../../lib/sessionToken'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase no configurado')
  return createClient(url, key)
}

const MAX_LOGO_LEN = 70000

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { groupId, userId, token, team_name, team_logo } = body
    if (!groupId || !userId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const valid = await verifyWriteToken(token, groupId, userId)
    if (!valid) {
      return NextResponse.json({ error: 'Token no válido' }, { status: 403 })
    }

    const teamName =
      team_name === undefined
        ? undefined
        : String(team_name ?? '').trim().slice(0, 48) || null

    let teamLogo = undefined
    if (team_logo !== undefined) {
      if (team_logo === null || team_logo === '') {
        teamLogo = null
      } else if (typeof team_logo !== 'string' || !team_logo.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Logo no válido' }, { status: 400 })
      } else if (team_logo.length > MAX_LOGO_LEN) {
        return NextResponse.json({ error: 'Logo demasiado grande' }, { status: 400 })
      } else {
        teamLogo = team_logo
      }
    }

    const supabase = getAdmin()
    const { data: row } = await supabase
      .from('porra_participants')
      .select('id, group_id')
      .eq('id', userId)
      .single()

    if (!row || row.group_id !== groupId) {
      return NextResponse.json({ error: 'Participante no encontrado' }, { status: 404 })
    }

    const patch = { updated_at: new Date().toISOString() }
    if (teamName !== undefined) patch.team_name = teamName
    if (teamLogo !== undefined) patch.team_logo = teamLogo

    const { error } = await supabase.from('porra_participants').update(patch).eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, team_name: patch.team_name, team_logo: patch.team_logo })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
