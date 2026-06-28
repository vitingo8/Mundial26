import { createClient } from '@supabase/supabase-js'
import { buildEliminatoriasKnockoutSchedule, knockoutRealKoMatchId, lookupEliminatoriasKoPred } from '../lib/knockoutBridge.js'
import { isEliminatoriasPredComplete } from '../lib/eliminatoriasReminder.js'
import { isEliminatoriasMatchLocked } from '../lib/eliminatoriasMatchLock.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { isResolvedTeamName } from '../lib/resolvedTeamName.js'

const GROUP_NAME = process.argv[2] || 'Orleans League'
const R32_FROM = 73
const R32_TO = 88

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const { data: group, error: gErr } = await sb
  .from('porra_groups')
  .select('id,name,results,phase')
  .ilike('name', `%${GROUP_NAME}%`)
  .single()
if (gErr || !group) throw new Error(gErr?.message || 'group not found')

const { data: participants, error: pErr } = await sb
  .from('porra_participants')
  .select('id,name,predictions')
  .eq('group_id', group.id)
  .order('name')
if (pErr) throw new Error(pErr.message)

const wcData = await getWcMatchesSafe()
const wcMatches = wcData?.matches || []
const fotmobStandings = wcData?.standings ?? null
const groupMatches = transformGroupMatches(wcMatches)
const knockoutMatches = transformKnockoutMatches(wcMatches)
const now = new Date()

function lookupKoPred(koPreds, match) {
  return lookupEliminatoriasKoPred(koPreds, match)
}

const schedule = buildEliminatoriasKnockoutSchedule(knockoutMatches, {}, {
  groupMatches,
  apiMatches: wcMatches,
  fotmobStandings,
})
const r32Matches = schedule.filter(m => m.matchNumber >= R32_FROM && m.matchNumber <= R32_TO)
const r32Playable = r32Matches.filter(m => isResolvedTeamName(m.home) && isResolvedTeamName(m.away))
const r32Editable = r32Playable.filter(m => !isEliminatoriasMatchLocked(m, { now }))
const r32Locked = r32Playable.filter(m => isEliminatoriasMatchLocked(m, { now }))

const report = {
  group: group.name,
  phase: group.phase,
  fecha: now.toISOString(),
  r32Total: r32Matches.length,
  standingsReady: Boolean(fotmobStandings?.ready),
  r32ConEquiposDefinidos: r32Playable.length,
  r32Editables: r32Editable.length,
  r32Cerrados: r32Locked.length,
  partidosEditables: r32Editable.map(m => ({
    P: m.matchNumber,
    partido: `${m.home} vs ${m.away}`,
    fecha: m.utcDate,
    status: m.status,
  })),
  partidosCerrados: r32Locked.map(m => ({
    P: m.matchNumber,
    partido: `${m.home} vs ${m.away}`,
    fecha: m.utcDate,
    status: m.status,
    resultado: m.score?.fullTime
      ? `${m.score.fullTime.home}-${m.score.fullTime.away}`
      : null,
  })),
  jugadores: [],
}

for (const p of participants) {
  const koPreds = p.predictions?.knockout || {}
  const missingEditable = []
  const missingLocked = []

  for (const m of r32Playable) {
    const pred = lookupKoPred(koPreds, m)
    const complete = isEliminatoriasPredComplete(pred)
    const locked = isEliminatoriasMatchLocked(m, { now })
    const entry = {
      P: m.matchNumber,
      partido: `${m.home} vs ${m.away}`,
      pred: complete
        ? `${pred.home}-${pred.away}${pred.advances ? ` (${pred.advances})` : ''}`
        : null,
    }
    if (complete) continue
    if (locked) missingLocked.push(entry)
    else missingEditable.push(entry)
  }

  report.jugadores.push({
    nombre: p.name,
    totalR32Definidos: r32Playable.length,
    faltanEditables: missingEditable.length,
    faltanCerrados: missingLocked.length,
    faltanTotal: missingEditable.length + missingLocked.length,
    partidosSinPronostico: [...missingLocked, ...missingEditable],
    resumen: missingEditable.length + missingLocked.length === 0 ? 'COMPLETO' : 'INCOMPLETO',
  })
}

report.resumen = {
  totalJugadores: participants.length,
  completos: report.jugadores.filter(j => j.resumen === 'COMPLETO').length,
  incompletos: report.jugadores.filter(j => j.resumen === 'INCOMPLETO').length,
  incompletosLista: report.jugadores
    .filter(j => j.resumen === 'INCOMPLETO')
    .map(j => ({
      nombre: j.nombre,
      faltan: j.faltanTotal,
      partidos: j.partidosSinPronostico,
    })),
}

console.log(JSON.stringify(report, null, 2))
