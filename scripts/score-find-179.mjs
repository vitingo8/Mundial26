#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { calcParticipantScoreColumns } from '../lib/gameData.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: groups } = await sb.from('porra_groups').select('id,name,results,actuals')
const wc = await getWcMatchesSafe()
const gm = transformGroupMatches(wc.matches)
const km = transformKnockoutMatches(wc.matches)
const kmBroken = km.map(m => m.id === '4653842' ? { ...m, matchNumber: undefined, fifaMatchLabel: null } : m)

for (const group of groups || []) {
  const { data: users } = await sb.from('porra_participants').select('id,name,predictions').eq('group_id', group.id)
  for (const u of users || []) {
    const now = calcParticipantScoreColumns({ predictions: u.predictions }, group, { groupMatches: gm, knockoutMatches: km, apiMatches: wc.matches })
    if (now.total >= 170 && now.total <= 185) {
      const before = calcParticipantScoreColumns({ predictions: u.predictions }, group, { groupMatches: gm, knockoutMatches: kmBroken, apiMatches: wc.matches })
      console.log(JSON.stringify({
        group: group.name,
        user: u.name,
        before: before.total,
        now: now.total,
        delta: +(now.total - before.total).toFixed(1),
        knockoutPts: now.knockoutPts,
        inicioPts: now.inicioPts,
      }))
    }
  }
}
