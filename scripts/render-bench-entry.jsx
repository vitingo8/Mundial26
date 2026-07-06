/**
 * Monta GroupDashboard en jsdom con datos reales para medir el primer render.
 * Se ejecuta bundlead con esbuild (ver render-bench.mjs).
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import GroupDashboard from '../components/GroupDashboard'
import { getWcMatchesSafe } from '../lib/fotmobServerCache.js'
import { transformGroupMatches, transformKnockoutMatches } from '../lib/footballData.js'

const VIEW_MODE = process.env.BENCH_VIEW_MODE || 'daily'
localStorage.setItem('porra_schedule_view_mode', VIEW_MODE)

const data = await getWcMatchesSafe()
console.log(`[bench] fuente=${data._source} partidos=${data.matches.length} viewMode=${VIEW_MODE}`)

// Sembrar caché de sesión para que useWcMatches arranque con datos completos
sessionStorage.setItem('porra_wc_matches_v2', JSON.stringify({
  ts: Date.now(),
  data: data.matches,
  standings: data.standings,
  live: false,
}))

const groupMatches = transformGroupMatches(data.matches)
const knockoutMatches = transformKnockoutMatches(data.matches)

const groupPreds = {}
for (const m of groupMatches) groupPreds[m.id] = { home: 1, away: 0 }
const inicioKoPreds = {}
for (let n = 73; n <= 104; n++) inicioKoPreds[`inicio-ko-${n}`] = { home: 1, away: 0 }
const koPreds = {}
for (const m of knockoutMatches) koPreds[m.id] = { home: 1, away: 0, advances: 'home' }
const rawPreds = { group: groupPreds, knockout: koPreds, inicioKnockout: inicioKoPreds, bonuses: {} }

const participants = {}
for (let i = 0; i < 10; i++) {
  participants[`p${i}`] = {
    id: `p${i}`,
    name: `Jugador ${i}`,
    team_name: `Equipo ${i}`,
    is_admin: i === 0,
    predictions: rawPreds,
    updated_at: new Date().toISOString(),
  }
}
const group = {
  id: 'bench',
  name: 'Bench League',
  phase: 'knockout',
  participants,
  results: { group: {}, knockout: {} },
  actuals: {},
}
const user = participants.p1

const { WcMatchesProvider } = await import('../hooks/useWcMatches')

const container = document.getElementById('root')
const root = createRoot(container)

const t0 = performance.now()
root.render(
  <WcMatchesProvider>
    <GroupDashboard
      group={group}
      user={user}
      refreshGroup={async () => null}
      setCurrentUser={() => {}}
      notify={() => {}}
      onLeave={() => {}}
      onGoHome={() => {}}
      onSwitchGroup={() => {}}
      onMounted={() => {}}
    />
  </WcMatchesProvider>,
)

// React 18 createRoot: el render inicial es síncrono dentro de render() en modo legacy-flush?
// No: se planifica. Esperamos macrotasks para que se complete todo (render + efectos + re-renders).
await new Promise(r => setTimeout(r, 50))
const t1 = performance.now()
console.log(`[bench] montaje completo (render + efectos + re-renders): ${(t1 - t0).toFixed(0)} ms`)
console.log(`[bench] nodos DOM: ${container.querySelectorAll('*').length}`)

await new Promise(r => setTimeout(r, 300))
const t2 = performance.now()
console.log(`[bench] tras 300ms extra (timers/idle): ${(t2 - t0).toFixed(0)} ms total`)
process.exit(0)
