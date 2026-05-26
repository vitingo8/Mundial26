import fs from 'fs'

let c = fs.readFileSync('components/GroupDashboard.js.bak', 'utf8')

// New imports block at top after 'use client'
const extraImports = `
import { getStoredWriteToken } from '../lib/sessionToken'
import { migratePredictionMap, countOrphanPredKeys } from '../lib/matchIdMap'
import { isPhaseLocked, getPhaseLockMessage, msUntilDeadline, formatCountdown } from '../lib/phaseLock'
import { parseResultsPaste, finishedMatchesToResults } from '../lib/adminCsv'
import { usePredictions } from '../hooks/usePredictions'
import { useWcMatches } from '../hooks/useWcMatches'
import InviteQr from './InviteQr'
`

if (!c.includes('usePredictions')) {
  c = c.replace(
    "import { supabase } from '../lib/supabase'",
    "import { supabase } from '../lib/supabase'" + extraImports
  )
  c = c.replace(
    'hasAnyPublishedResults, getDefaultPredPhase,\n} from',
    'hasAnyPublishedResults, getDefaultPredPhase, getAdminTaskBadges,\n} from'
  )
  c = c.replace(
    `import {
  fetchWcMatchesClient,
  transformGroupMatches,`,
    `import {
  transformGroupMatches,`
  )
}

// GroupTab QR
if (!c.includes('InviteQr')) {
  c = c.replace(
    '<button type="button" style={s.inviteShareBtn} onClick={onShare}>📤 Compartir invitación</button>',
    '<button type="button" style={s.inviteShareBtn} onClick={onShare}>📤 Compartir invitación</button>\n        <InviteQr url={shareUrl} />'
  )
}

// LiveMatchCard go to prediction
if (!c.includes('onGoToPrediction')) {
  c = c.replace(
    'function LiveTab({ liveData, apiStatus, apiError, onFetch, wcLoading, group, groupMatches, userPreds }) {',
    'function LiveTab({ liveData, apiStatus, apiError, onFetch, wcLoading, group, groupMatches, userPreds, onGoToPrediction }) {'
  )
  c = c.replace(
    'function LiveMatchCard({ match: m, highlight, upcoming }) {',
    'function LiveMatchCard({ match: m, highlight, upcoming, onGoToPrediction }) {'
  )
  c = c.replace(
    `{matchStatusLabel(m.status, highlight, isUpcoming)}
      </div>
    </div>
  )
}`,
    `{matchStatusLabel(m.status, highlight, isUpcoming)}
      </div>
      {onGoToPrediction && (
        <button type="button" style={s.goPredBtn} onClick={() => onGoToPrediction(m.id)}>
          Ver mi predicción →
        </button>
      )}
    </div>
  )
}`
  )
  c = c.replace(
    '{live.map(m => <LiveMatchCard key={m.id} match={m} highlight />)}',
    '{live.map(m => <LiveMatchCard key={m.id} match={m} highlight onGoToPrediction={onGoToPrediction} />)}'
  )
  c = c.replace(
    '{finished.slice(0, 20).map(m => <LiveMatchCard key={m.id} match={m} />)}',
    '{finished.slice(0, 20).map(m => <LiveMatchCard key={m.id} match={m} onGoToPrediction={onGoToPrediction} />)}'
  )
}

// phases Bonus -> Especiales
c = c.replace("sub: 'Bonus'", "sub: 'Esp.'")

// MatchRow responsive classes
c = c.replace(
  'function MatchRow({ home, away, homeCrest, awayCrest, meta, homeVal, awayVal, onHome, onAway, onShortcut, locked }) {',
  'function MatchRow({ home, away, homeCrest, awayCrest, meta, homeVal, awayVal, onHome, onAway, onShortcut, locked, matchRef }) {'
)
c = c.replace(
  `return (
    <div style={s.matchRowWrap}>
      <div style={s.matchRow}>
        <div style={s.teamCell}>`,
  `return (
    <div style={s.matchRowWrap} ref={matchRef}>
      <div className="match-row-inner">
        <div className="match-row-teams">
        <div style={s.teamCell}>`
)
c = c.replace(
  `        </div>
        <div style={s.scoreBox}>
          <input type="number" style={s.scoreIn}`,
  `        </div>
        </div>
        <div className="match-row-scores" style={s.scoreBox}>
          <input type="number" className="score-in input-touch" style={s.scoreIn} inputMode="numeric"`
)
c = c.replace(
  'onChange={e => onAway(e.target.value)} placeholder="-" disabled={locked} aria-label={`Goles ${away}`} />',
  'onChange={e => onAway(e.target.value)} placeholder="-" disabled={locked} aria-label={`Goles ${away}`} />\n        </div>'
)
c = c.replace(
  `      {onShortcut && !locked && (
        <div style={s.shortcutRow}>`,
  `      {onShortcut && !locked && (
        <div className="shortcut-row" style={s.shortcutRow}>`
)
c = c.replace(
  `            <button key={\`\${h}-\${a}\`} type="button" style={s.shortcutBtn}`,
  `            <button key={\`\${h}-\${a}\`} type="button" className="shortcut-btn" style={s.shortcutBtn}`
)

// filter chips scroll
c = c.replace('<div style={s.filterRow}>', '<div className="chips-scroll" style={s.filterRow}>')
c = c.replace(
  '<button type="button" style={{ ...s.chip, ...(!filterGroup ? s.chipActive : {}) }}',
  '<button type="button" className="chip-btn" style={{ ...s.chip, ...(!filterGroup ? s.chipActive : {}) }}'
)

// admin grid
c = c.replace(
  '{adminTab === \'results\' && (\n        <div>',
  '{adminTab === \'results\' && (\n        <div className="admin-results-grid">'
)

// styles
if (!c.includes('goPredBtn')) {
  c = c.replace(
    '  spinner: {',
    `  goPredBtn: {
    width: '100%', marginTop: 8, padding: '10px', border: '1px solid var(--accent-glow)',
    background: 'var(--accent-dim)', borderRadius: 10, fontWeight: 700, fontSize: 13,
    color: 'var(--accent-dark)', cursor: 'pointer', minHeight: 44,
  },
  adminBadgesRow: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 8px' },
  adminBadge: {
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
    background: 'var(--accent-dim)', color: 'var(--accent-dark)', border: '1px solid var(--accent-glow)',
  },
  adminBadgeWarn: { background: 'var(--yellow-dim)', color: 'var(--yellow)', borderColor: 'var(--yellow-border)' },
  csvArea: {
    width: '100%', minHeight: 80, background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 10, padding: 10, fontSize: 12, fontFamily: 'monospace', marginBottom: 8,
  },
  spinner: {`
  )
}

const out = process.argv[2] || 'components/GroupDashboard.js'
fs.writeFileSync(out, c)
console.log('written base patches')
