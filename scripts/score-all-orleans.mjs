#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: group } = await sb.from('porra_groups').select('*').ilike('name', '%Orleans%').single()
const { data: users } = await sb.from('porra_participants').select('id,name,predictions').eq('group_id', group.id)
const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const kmBroken = km.map(m => m.id === '4653842' ? { ...m, matchNumber: undefined, fifaMatchLabel: null } : m)

for (const u of users || []) {
  const now = calcParticipantScoreColumns({ predictions: u.predictions }, group, { groupMatches: gm, knockoutMatches: km, apiMatches: wc.matches })
  const before = calcParticipantScoreColumns({ predictions: u.predictions }, group, { groupMatches: gm, knockoutMatches: kmBroken, apiMatches: wc.matches })
  const d = +(now.total - before.total).toFixed(1)
  if (d !== 0 || now.total >= 170) {
    console.log(`${u.name}: ${before.total} → ${now.total} (Δ ${d > 0 ? '+' : ''}${d})`)
  }
}
