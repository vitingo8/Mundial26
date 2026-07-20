import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findParticipantsByEmail } from '../../../../lib/participantLookup'
import { isValidEmail, normalizeEmail } from '../../../../lib/emailUtils'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase no configurado en el servidor (.env.local)')
  }
  return createClient(url, key)
}

export async function GET(request) {
  try {
    const email = normalizeEmail(request.nextUrl.searchParams.get('email') || '')
    if (!email) {
      return NextResponse.json({ error: 'Falta el email' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }

    const matches = await findParticipantsByEmail(getSupabase(), email)
    return NextResponse.json({ matches })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Error al buscar el email' }, { status: 500 })
  }
}
