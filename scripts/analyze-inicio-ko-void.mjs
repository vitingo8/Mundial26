import { createClient } from '@supabase/supabase-js'
import { buildInicioKnockoutSchedule } from '../lib/knockoutBridge.js'
import {
  buildInicioKnockoutScoringState,
  getInicioKnockoutUiStatus,
  findRealKnockoutMatchForPair,
} from '../lib/inicioKnockoutScoring.js'
import { isResolvedTeamName } from '../lib/knockoutMatchScoring.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'

const GROUP_NAME = process.argv[2] || 'Orleans League'
const USER_NAME = process.argv[3] || 'David Espuny'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const { data: group, error: gErr } = await sb
  .from('porra_groups')
  .select('id,name,results')
  .ilike('name', `%${GROUP_NAME}%`)
  .single()
if (gErr || !group) throw new Error(gErr?.message || 'group not found')

const { data: user, error: uErr } = await sb
  .from('porra_participants')
  .select('id,name,predictions')
  .eq('group_id', group.id)
  .ilike('name', `%${USER_NAME.split(' ')[1] || USER_NAME}%`)
  .limit(5)
const david = (user || []).find(p => p.name.toLowerCase().includes('david') && p.name.toLowerCase().includes('espuny'))
  || user?.[0]
if (!david) throw new Error('user not found')

const preds = david.predictions || {}
const wcData = await getWcMatchesSafe()
const wcMatches = wcData?.matches || []
const groupMatches = transformGroupMatches(wcMatches)
const knockoutMatches = transformKnockoutMatches(wcMatches)
const knockoutResults = group.results?.knockout || {}

const participant = { predictions: preds }
const { schedule } = buildInicioKnockoutSchedule(
  groupMatches,
  preds.group || {},
  preds.inicioKnockout || {},
)
const state = buildInicioKnockoutScoringState(participant, {
  groupMatches,
  knockoutMatches,
  knockoutResults,
})

const rows = schedule
  .filter(m => isResolvedTeamName(m.home) && isResolvedTeamName(m.away))
  .map(m => {
    const ui = getInicioKnockoutUiStatus(m.home, m.away, m.matchNumber, state)
    const real = findRealKnockoutMatchForPair(m.home, m.away, state, m.matchNumber)
    const slotReal = state.actualByMatchNumber[m.matchNumber]
    const pred = preds.inicioKnockout?.[m.id]
    return {
      P: m.matchNumber,
      round: m.roundLabel || m.roundId,
      predicted: `${m.home} vs ${m.away}`,
      predScore: pred ? `${pred.home}-${pred.away}${pred.advances ? ` (${pred.advances} pasa)` : ''}` : null,
      status: ui.void ? 'TACHADO (+0)' : ui.pending ? 'PENDIENTE (aún puede pasar)' : 'ACTIVO (puede puntuar)',
      realSlot: slotReal ? `${slotReal.home} vs ${slotReal.away}` : null,
      realPair: real
        ? `${real.teams.home} vs ${real.teams.away}${real.result?.home != null ? ` → ${real.result.home}-${real.result.away}` : ''}`
        : null,
    }
  })

console.log(JSON.stringify({
  group: group.name,
  user: david.name,
  knockoutPublished: Object.keys(knockoutResults).length,
  r32Real: knockoutMatches.filter(m => m.matchNumber >= 73 && m.matchNumber <= 88 && isResolvedTeamName(m.home) && isResolvedTeamName(m.away)).map(m => `P${m.matchNumber}: ${m.home} vs ${m.away} (${m.status})`),
  summary: {
    total: rows.length,
    voided: rows.filter(r => r.status.startsWith('TACHADO')).length,
    pending: rows.filter(r => r.status.startsWith('PENDIENTE')).length,
    active: rows.filter(r => r.status.startsWith('ACTIVO')).length,
  },
  voided: rows.filter(r => r.status.startsWith('TACHADO')),
  pending: rows.filter(r => r.status.startsWith('PENDIENTE')),
  active: rows.filter(r => r.status.startsWith('ACTIVO')),
}, null, 2))
