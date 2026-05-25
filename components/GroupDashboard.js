'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  generateGroupMatches, KNOCKOUT_ROUNDS, SCORING,
  calcLeaderboard, isDeadlinePassed
} from '../lib/gameData'

const GROUP_MATCHES = generateGroupMatches()

export default function GroupDashboard({ group, user, refreshGroup, setCurrentUser, notify, onLeave }) {
  const [tab, setTab] = useState('group')
  const [predPhase, setPredPhase] = useState('group')
  const [groupPreds, setGroupPreds] = useState(user.predictions?.group || {})
  const [koPreds, setKoPreds] = useState(user.predictions?.knockout || {})
  const [bonusPreds, setBonusPreds] = useState(user.predictions?.bonuses || { topScorer: '', topKeeper: '', topAssists: '', mvp: '' })
  const [saving, setSaving] = useState(false)
  const [liveData, setLiveData] = useState([])
  const [apiStatus, setApiStatus] = useState('idle')
  const [currentGroup, setCurrentGroup] = useState(group)

  const leaderboard = calcLeaderboard(currentGroup)
  const isAdmin = user.is_admin
  const groupDeadlinePassed = isDeadlinePassed(currentGroup.group_deadline)
  const koDeadlinePassed = isDeadlinePassed(currentGroup.knockout_deadline)
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}?join=${currentGroup.id}`

  async function handleRefresh() {
    const updated = await refreshGroup(currentGroup.id)
    if (updated) setCurrentGroup(updated)
  }

  // Auto-refresh leaderboard every 60s
  useEffect(() => {
    const t = setInterval(handleRefresh, 60000)
    return () => clearInterval(t)
  }, [currentGroup.id])

  async function savePredictions() {
    if (groupDeadlinePassed && predPhase === 'group') {
      notify('⏰ Plazo de la fase de grupos cerrado', 'warning'); return
    }
    if (koDeadlinePassed && predPhase === 'knockout') {
      notify('⏰ Plazo de eliminatorias cerrado', 'warning'); return
    }
    setSaving(true)
    const predictions = { group: groupPreds, knockout: koPreds, bonuses: bonusPreds }
    const { error } = await supabase
      .from('porra_participants')
      .update({ predictions, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) { notify('Error guardando: ' + error.message, 'error') }
    else {
      notify('💾 Predicciones guardadas')
      setCurrentUser({ ...user, predictions })
    }
    setSaving(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => notify('📋 Link copiado'))
  }

  async function fetchLive() {
    setApiStatus('loading')
    try {
      const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': '' }
      })
      if (res.ok) {
        const data = await res.json()
        setLiveData(data.matches || [])
        setApiStatus('ok')
      } else {
        setApiStatus('unavailable')
      }
    } catch {
      setApiStatus('unavailable')
    }
  }

  const tabs = [
    { id: 'group', icon: '👥', label: 'Grupo' },
    { id: 'predictions', icon: '🎯', label: 'Porra' },
    { id: 'leaderboard', icon: '🏆', label: 'Ranking' },
    { id: 'live', icon: '🔴', label: 'En Vivo' },
    ...(isAdmin ? [{ id: 'admin', icon: '⚙️', label: 'Admin' }] : []),
  ]

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div>
            <div style={s.groupName}>{currentGroup.name}</div>
            <div style={s.groupMeta}>
              <span style={s.codeTag}>#{currentGroup.id}</span>
              <span style={s.userTag}>👤 {user.name}</span>
            </div>
          </div>
          <button style={s.shareBtn} onClick={copyLink}>📋 Invitar</button>
        </div>

        {/* Deadlines */}
        {(currentGroup.group_deadline || currentGroup.knockout_deadline) && (
          <div style={s.deadlines}>
            {currentGroup.group_deadline && (
              <DeadlineBadge label="Grupos" deadline={currentGroup.group_deadline} passed={groupDeadlinePassed} />
            )}
            {currentGroup.knockout_deadline && (
              <DeadlineBadge label="Eliminatorias" deadline={currentGroup.knockout_deadline} passed={koDeadlinePassed} />
            )}
          </div>
        )}

        {/* Tab bar */}
        <div style={s.tabBar}>
          {tabs.map(t => (
            <button key={t.id}
              style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
              onClick={() => setTab(t.id)}>
              <span>{t.icon}</span>
              <span style={s.tabLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>

        {tab === 'group' && (
          <GroupTab group={currentGroup} leaderboard={leaderboard} shareUrl={shareUrl} onLeave={onLeave} />
        )}

        {tab === 'predictions' && (
          <PredictionsTab
            predPhase={predPhase} setPredPhase={setPredPhase}
            groupPreds={groupPreds} setGroupPreds={setGroupPreds}
            koPreds={koPreds} setKoPreds={setKoPreds}
            bonusPreds={bonusPreds} setBonusPreds={setBonusPreds}
            saving={saving} onSave={savePredictions}
            groupDeadlinePassed={groupDeadlinePassed}
            koDeadlinePassed={koDeadlinePassed}
          />
        )}

        {tab === 'leaderboard' && (
          <LeaderboardTab leaderboard={leaderboard} onRefresh={handleRefresh} />
        )}

        {tab === 'live' && (
          <LiveTab liveData={liveData} apiStatus={apiStatus} onFetch={fetchLive} />
        )}

        {tab === 'admin' && isAdmin && (
          <AdminTab
            group={currentGroup}
            setGroup={setCurrentGroup}
            refreshGroup={refreshGroup}
            notify={notify}
          />
        )}
      </div>
    </div>
  )
}

// ─── GROUP TAB ────────────────────────────────────────────────────────────────
function GroupTab({ group, leaderboard, shareUrl, onLeave }) {
  const participants = Object.values(group.participants || {})

  return (
    <div style={s.tabContent}>
      <div style={s.inviteCard}>
        <div style={s.inviteText}>
          Comparte este link para invitar al grupo:
          <div style={s.shareUrl}>{shareUrl}</div>
        </div>
      </div>

      <SectionTitle>👥 Participantes ({participants.length})</SectionTitle>
      {leaderboard.map((p, i) => (
        <div key={p.id} style={s.participantCard}>
          <div style={s.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
          <div style={s.avatar}>{p.name[0].toUpperCase()}</div>
          <div style={s.pInfo}>
            <div style={s.pName}>
              {p.name}
              {p.is_admin && <span style={s.adminTag}>Admin</span>}
            </div>
            <div style={s.pMeta}>ID: {p.id}{p.email ? ` · ${p.email}` : ''}</div>
          </div>
          <div style={s.pPts}>{p.total} <span style={{ fontSize: 11, color: 'var(--muted)' }}>pts</span></div>
        </div>
      ))}

      <button style={s.leaveBtn} onClick={onLeave}>← Salir del grupo</button>
    </div>
  )
}

// ─── PREDICTIONS TAB ──────────────────────────────────────────────────────────
function PredictionsTab({ predPhase, setPredPhase, groupPreds, setGroupPreds, koPreds, setKoPreds, bonusPreds, setBonusPreds, saving, onSave, groupDeadlinePassed, koDeadlinePassed }) {

  const phases = [
    { id: 'group', icon: '🏟️', label: 'Grupos', sub: '60%', locked: groupDeadlinePassed },
    { id: 'knockout', icon: '⚔️', label: 'Eliminatorias', sub: '40%', locked: koDeadlinePassed },
    { id: 'bonuses', icon: '⭐', label: 'Especiales', sub: 'Bonus', locked: false },
  ]

  return (
    <div style={s.tabContent}>
      <div style={s.phasePicker}>
        {phases.map(p => (
          <button key={p.id}
            style={{ ...s.phaseBtn, ...(predPhase === p.id ? s.phaseActive : {}) }}
            onClick={() => setPredPhase(p.id)}>
            <span style={{ fontSize: 20 }}>{p.icon}</span>
            <span style={s.phaseLabel}>{p.label}</span>
            <span style={{ ...s.phaseSub, color: p.locked ? 'var(--red)' : 'var(--accent)' }}>
              {p.locked ? '🔒' : p.sub}
            </span>
          </button>
        ))}
      </div>

      {predPhase === 'group' && (
        <GroupPhasePreds preds={groupPreds} setPreds={setGroupPreds} locked={groupDeadlinePassed} />
      )}
      {predPhase === 'knockout' && (
        <KnockoutPreds preds={koPreds} setPreds={setKoPreds} locked={koDeadlinePassed} />
      )}
      {predPhase === 'bonuses' && (
        <BonusPreds preds={bonusPreds} setPreds={setBonusPreds} />
      )}

      <button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={onSave} disabled={saving}>
        {saving ? <span style={s.spinner} /> : '💾'} Guardar predicciones
      </button>
    </div>
  )
}

function GroupPhasePreds({ preds, setPreds, locked }) {
  const byGroup = {}
  GROUP_MATCHES.forEach(m => {
    if (!byGroup[m.group]) byGroup[m.group] = []
    byGroup[m.group].push(m)
  })

  function setScore(id, side, val) {
    const v = parseInt(val)
    if (isNaN(v) || v < 0 || v > 20) return
    setPreds(p => ({ ...p, [id]: { ...p[id], [side]: v } }))
  }

  const filled = Object.keys(preds).length
  const total = GROUP_MATCHES.length

  return (
    <div>
      {locked && <div style={s.lockedBanner}>🔒 Plazo cerrado · Solo lectura</div>}
      <div style={s.progressWrap}>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${Math.round(filled / total * 100)}%` }} />
        </div>
        <span style={s.progressText}>{filled}/{total} partidos</span>
      </div>
      {Object.entries(byGroup).map(([grp, matches]) => (
        <div key={grp} style={s.matchGroup}>
          <div style={s.matchGroupHeader}>Grupo {grp}</div>
          {matches.map(m => (
            <MatchRow key={m.id}
              home={m.home} away={m.away}
              homeVal={preds[m.id]?.home ?? ''}
              awayVal={preds[m.id]?.away ?? ''}
              onHome={v => setScore(m.id, 'home', v)}
              onAway={v => setScore(m.id, 'away', v)}
              locked={locked}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function KnockoutPreds({ preds, setPreds, locked }) {
  function setVal(id, key, val) {
    const v = key === 'home' || key === 'away' ? parseInt(val) : val
    if ((key === 'home' || key === 'away') && (isNaN(v) || v < 0)) return
    setPreds(p => ({ ...p, [id]: { ...p[id], [key]: v } }))
  }

  return (
    <div>
      {locked && <div style={s.lockedBanner}>🔒 Plazo cerrado · Solo lectura</div>}
      <div style={s.koNote}>
        Introduce los equipos que crees que llegarán a cada ronda y el resultado.
      </div>
      {KNOCKOUT_ROUNDS.map(round => (
        <div key={round.id} style={s.matchGroup}>
          <div style={s.matchGroupHeader}>{round.emoji} {round.label}</div>
          {Array.from({ length: round.matches }).map((_, i) => {
            const id = `${round.id}-${i}`
            return (
              <div key={id} style={s.koMatchRow}>
                <input style={s.teamIn} placeholder="Local" value={preds[id]?.homeTeam || ''} onChange={e => setVal(id, 'homeTeam', e.target.value)} disabled={locked} />
                <div style={s.scoreBox}>
                  <input type="number" style={s.scoreIn} value={preds[id]?.home ?? ''} onChange={e => setVal(id, 'home', e.target.value)} placeholder="0" disabled={locked} />
                  <span style={s.dash}>-</span>
                  <input type="number" style={s.scoreIn} value={preds[id]?.away ?? ''} onChange={e => setVal(id, 'away', e.target.value)} placeholder="0" disabled={locked} />
                </div>
                <input style={s.teamIn} placeholder="Visitante" value={preds[id]?.awayTeam || ''} onChange={e => setVal(id, 'awayTeam', e.target.value)} disabled={locked} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function BonusPreds({ preds, setPreds }) {
  const fields = [
    { id: 'topScorer', label: '⚽ Máximo Goleador', pts: 5 },
    { id: 'topKeeper', label: '🧤 Portero menos goleado', pts: 5 },
    { id: 'topAssists', label: '🅰️ Máximo Asistente', pts: 5 },
    { id: 'mvp', label: '⭐ MVP del Torneo', pts: 10 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fields.map(f => (
        <div key={f.id}>
          <div style={s.bonusLabel}>
            {f.label} <span style={s.bonusPts}>+{f.pts} pts</span>
          </div>
          <input style={s.input}
            placeholder="Nombre del jugador"
            value={preds[f.id] || ''}
            onChange={e => setPreds(p => ({ ...p, [f.id]: e.target.value }))}
          />
        </div>
      ))}
    </div>
  )
}

function MatchRow({ home, away, homeVal, awayVal, onHome, onAway, locked }) {
  return (
    <div style={s.matchRow}>
      <span style={s.team}>{home}</span>
      <div style={s.scoreBox}>
        <input type="number" style={s.scoreIn} value={homeVal} onChange={e => onHome(e.target.value)} placeholder="-" disabled={locked} />
        <span style={s.dash}>-</span>
        <input type="number" style={s.scoreIn} value={awayVal} onChange={e => onAway(e.target.value)} placeholder="-" disabled={locked} />
      </div>
      <span style={{ ...s.team, textAlign: 'right' }}>{away}</span>
    </div>
  )
}

// ─── LEADERBOARD TAB ──────────────────────────────────────────────────────────
function LeaderboardTab({ leaderboard, onRefresh }) {
  return (
    <div style={s.tabContent}>
      <div style={s.lbHeader}>
        <SectionTitle>🏆 Clasificación</SectionTitle>
        <button style={s.refreshBtn} onClick={onRefresh}>🔄</button>
      </div>
      <div style={s.lbNote}>Grupos ×0.6 + Eliminatorias ×0.4 + Bonificaciones</div>
      {leaderboard.map((p, i) => (
        <div key={p.id} style={{ ...s.lbRow, ...(i === 0 ? s.lbFirst : {}) }}>
          <div style={s.lbRank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
          <div style={s.lbAvatar}>{p.name[0].toUpperCase()}</div>
          <div style={s.lbInfo}>
            <div style={s.lbName}>{p.name}</div>
            <div style={s.lbBreak}>
              Gr: {Math.round(p.groupPts * 0.6 * 10) / 10} · KO: {Math.round(p.knockoutPts * 0.4 * 10) / 10} · Bonus: {p.bonusPts}
            </div>
          </div>
          <div style={s.lbTotal}>{p.total}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}> pts</span></div>
        </div>
      ))}
      {leaderboard.length === 0 && <EmptyState text="Sin participantes todavía" />}
    </div>
  )
}

// ─── LIVE TAB ─────────────────────────────────────────────────────────────────
function LiveTab({ liveData, apiStatus, onFetch }) {
  const finished = liveData.filter(m => m.status === 'FINISHED')
  const live = liveData.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')
  const upcoming = liveData.filter(m => m.status === 'SCHEDULED').slice(0, 10)

  return (
    <div style={s.tabContent}>
      <div style={s.liveHeader}>
        <SectionTitle>🔴 Resultados en Vivo</SectionTitle>
        <button style={s.fetchBtn} onClick={onFetch} disabled={apiStatus === 'loading'}>
          {apiStatus === 'loading' ? <span style={s.spinner} /> : '🔄'} Actualizar
        </button>
      </div>

      {apiStatus === 'idle' && (
        <div style={s.apiCard}>
          <div style={s.apiMsg}>Pulsa "Actualizar" para cargar resultados del Mundial 2026</div>
          <div style={s.apiSub}>Datos via football-data.org · Sin registro necesario</div>
        </div>
      )}
      {apiStatus === 'unavailable' && (
        <div style={{ ...s.apiCard, borderColor: 'rgba(251,191,36,0.3)' }}>
          <div style={{ color: 'var(--yellow)' }}>⚠️ API no disponible</div>
          <div style={s.apiSub}>El Mundial 2026 empieza en junio 2026. Los datos aparecerán al inicio del torneo.</div>
        </div>
      )}
      {apiStatus === 'ok' && (
        <div style={{ ...s.apiCard, borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ color: 'var(--green)' }}>✅ Datos actualizados</div>
        </div>
      )}

      {live.length > 0 && (
        <>
          <SectionTitle>⚡ En juego ahora</SectionTitle>
          {live.map(m => <LiveMatchCard key={m.id} match={m} highlight />)}
        </>
      )}
      {finished.length > 0 && (
        <>
          <SectionTitle>✅ Resultados</SectionTitle>
          {finished.slice(0, 20).map(m => <LiveMatchCard key={m.id} match={m} />)}
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <SectionTitle>📅 Próximos</SectionTitle>
          {upcoming.map(m => <LiveMatchCard key={m.id} match={m} upcoming />)}
        </>
      )}
    </div>
  )
}

function LiveMatchCard({ match: m, highlight, upcoming }) {
  return (
    <div style={{
      ...s.liveCard,
      ...(highlight ? { borderColor: 'var(--accent)', animation: 'glow 2s ease infinite' } : {})
    }}>
      <div style={s.liveTeams}>
        <span style={s.liveTeam}>{m.homeTeam?.shortName || m.homeTeam?.name}</span>
        <span style={s.liveScore}>
          {upcoming
            ? new Date(m.utcDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : `${m.score?.fullTime?.home ?? '-'} - ${m.score?.fullTime?.away ?? '-'}`
          }
        </span>
        <span style={{ ...s.liveTeam, textAlign: 'right' }}>{m.awayTeam?.shortName || m.awayTeam?.name}</span>
      </div>
      <div style={s.liveMeta}>J{m.matchday} · {highlight ? '🟢 EN JUEGO' : upcoming ? '🔜 Próximo' : '✅ Finalizado'}</div>
    </div>
  )
}

// ─── ADMIN TAB ────────────────────────────────────────────────────────────────
function AdminTab({ group, setGroup, refreshGroup, notify }) {
  const [adminTab, setAdminTab] = useState('deadlines')
  const [groupDeadline, setGroupDeadline] = useState(group.group_deadline ? group.group_deadline.slice(0, 16) : '')
  const [koDeadline, setKoDeadline] = useState(group.knockout_deadline ? group.knockout_deadline.slice(0, 16) : '')
  const [results, setResults] = useState(group.results || { group: {}, knockout: {} })
  const [actuals, setActuals] = useState(group.actuals || {})
  const [saving, setSaving] = useState(false)

  async function saveDeadlines() {
    setSaving(true)
    const { error } = await supabase.from('porra_groups').update({
      group_deadline: groupDeadline || null,
      knockout_deadline: koDeadline || null,
    }).eq('id', group.id)
    if (error) notify('Error: ' + error.message, 'error')
    else { notify('✅ Plazos guardados'); const g = await refreshGroup(group.id); if (g) setGroup(g) }
    setSaving(false)
  }

  async function saveResults() {
    setSaving(true)
    const { error } = await supabase.from('porra_groups').update({ results, actuals }).eq('id', group.id)
    if (error) notify('Error: ' + error.message, 'error')
    else { notify('✅ Resultados guardados'); const g = await refreshGroup(group.id); if (g) setGroup(g) }
    setSaving(false)
  }

  function setGroupResult(id, side, val) {
    const v = parseInt(val)
    if (isNaN(v) || v < 0) return
    setResults(r => ({ ...r, group: { ...r.group, [id]: { ...r.group[id], [side]: v } } }))
  }

  const byGroup = {}
  GROUP_MATCHES.forEach(m => {
    if (!byGroup[m.group]) byGroup[m.group] = []
    byGroup[m.group].push(m)
  })

  return (
    <div style={s.tabContent}>
      <SectionTitle>⚙️ Panel de Administración</SectionTitle>
      <div style={s.adminTabs}>
        {[
          { id: 'deadlines', label: '⏰ Plazos' },
          { id: 'results', label: '📊 Resultados' },
          { id: 'actuals', label: '🏅 Ganadores' },
        ].map(t => (
          <button key={t.id}
            style={{ ...s.adminTab, ...(adminTab === t.id ? s.adminTabActive : {}) }}
            onClick={() => setAdminTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {adminTab === 'deadlines' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.adminNote}>
            Define las fechas tope para que los participantes puedan editar sus predicciones.
            Pasado el plazo, las predicciones quedan bloqueadas automáticamente.
          </div>
          <div>
            <label style={s.label}>⏰ Fecha tope Fase de Grupos (60%)</label>
            <input type="datetime-local" style={s.input} value={groupDeadline} onChange={e => setGroupDeadline(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>⏰ Fecha tope Eliminatorias (40%)</label>
            <input type="datetime-local" style={s.input} value={koDeadline} onChange={e => setKoDeadline(e.target.value)} />
          </div>
          <button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={saveDeadlines} disabled={saving}>
            {saving ? <span style={s.spinner} /> : '💾'} Guardar plazos
          </button>
        </div>
      )}

      {adminTab === 'results' && (
        <div>
          <div style={s.adminNote}>Introduce los resultados reales para calcular puntuaciones.</div>
          {Object.entries(byGroup).map(([grp, matches]) => (
            <div key={grp} style={s.matchGroup}>
              <div style={s.matchGroupHeader}>Grupo {grp}</div>
              {matches.map(m => (
                <MatchRow key={m.id}
                  home={m.home} away={m.away}
                  homeVal={results.group?.[m.id]?.home ?? ''}
                  awayVal={results.group?.[m.id]?.away ?? ''}
                  onHome={v => setGroupResult(m.id, 'home', v)}
                  onAway={v => setGroupResult(m.id, 'away', v)}
                  locked={false}
                />
              ))}
            </div>
          ))}
          <button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={saveResults} disabled={saving}>
            {saving ? <span style={s.spinner} /> : '💾'} Guardar resultados
          </button>
        </div>
      )}

      {adminTab === 'actuals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.adminNote}>Introduce los ganadores reales para otorgar las bonificaciones.</div>
          {[
            { id: 'topScorer', label: '⚽ Máximo Goleador Real' },
            { id: 'topKeeper', label: '🧤 Portero Menos Goleado Real' },
            { id: 'topAssists', label: '🅰️ Máximo Asistente Real' },
            { id: 'mvp', label: '⭐ MVP Real del Torneo' },
          ].map(f => (
            <div key={f.id}>
              <label style={s.label}>{f.label}</label>
              <input style={s.input} placeholder="Nombre real"
                value={actuals[f.id] || ''}
                onChange={e => setActuals(a => ({ ...a, [f.id]: e.target.value }))} />
            </div>
          ))}
          <button style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={saveResults} disabled={saving}>
            {saving ? <span style={s.spinner} /> : '💾'} Guardar ganadores
          </button>
        </div>
      )}
    </div>
  )
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return <div style={s.sectionTitle}>{children}</div>
}

function EmptyState({ text }) {
  return <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 32, fontSize: 14 }}>{text}</div>
}

function DeadlineBadge({ label, deadline, passed }) {
  const d = new Date(deadline)
  return (
    <div style={{
      ...s.deadlineBadge,
      borderColor: passed ? 'rgba(239,68,68,0.3)' : 'rgba(249,115,22,0.3)',
      color: passed ? 'var(--red)' : 'var(--accent)'
    }}>
      {passed ? '🔒' : '⏰'} {label}: {d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  header: {
    background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50
  },
  headerTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '14px 16px 8px', gap: 12
  },
  groupName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 22, fontWeight: 900, letterSpacing: 0.5
  },
  groupMeta: { display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  codeTag: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    color: 'var(--accent)', borderRadius: 20, padding: '2px 10px',
    fontSize: 11, fontWeight: 700, letterSpacing: 1
  },
  userTag: { fontSize: 11, color: 'var(--muted)', alignSelf: 'center' },
  shareBtn: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    color: 'var(--accent)', borderRadius: 10, padding: '8px 14px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
  },
  deadlines: { display: 'flex', gap: 8, padding: '0 16px 8px', flexWrap: 'wrap' },
  deadlineBadge: {
    border: '1px solid', borderRadius: 20, padding: '3px 10px',
    fontSize: 11, fontWeight: 600
  },
  tabBar: {
    display: 'flex', overflowX: 'auto', gap: 2, padding: '0 12px 0',
    borderTop: '1px solid var(--border)',
    scrollbarWidth: 'none', msOverflowStyle: 'none'
  },
  tabBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    color: 'var(--muted)', padding: '8px 14px', cursor: 'pointer',
    fontSize: 18, flexShrink: 0, transition: 'all 0.2s'
  },
  tabActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)' },
  tabLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  content: { flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: '16px 16px 100px' },
  tabContent: { display: 'flex', flexDirection: 'column', gap: 14 },
  inviteCard: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    borderRadius: 14, padding: 14
  },
  inviteText: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 },
  shareUrl: {
    color: 'var(--accent)', fontSize: 12, wordBreak: 'break-all',
    marginTop: 4, fontWeight: 600
  },
  sectionTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 17, fontWeight: 800, letterSpacing: 0.3, color: 'var(--text)'
  },
  participantCard: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10
  },
  rank: { fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 },
  avatar: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15, flexShrink: 0
  },
  pInfo: { flex: 1, minWidth: 0 },
  pName: { fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 },
  pMeta: { color: 'var(--muted)', fontSize: 11, marginTop: 1 },
  pPts: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, color: 'var(--accent)', flexShrink: 0 },
  adminTag: {
    background: 'rgba(249,115,22,0.15)', color: 'var(--accent)',
    borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700
  },
  leaveBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    color: 'var(--muted)', borderRadius: 10, padding: '10px 16px',
    fontSize: 13, cursor: 'pointer', marginTop: 8
  },
  phasePicker: { display: 'flex', gap: 8 },
  phaseBtn: {
    flex: 1, background: 'var(--card)', border: '1.5px solid var(--border)',
    borderRadius: 12, padding: '10px 8px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
  },
  phaseActive: { border: '1.5px solid var(--accent)', background: 'var(--accent-dim)' },
  phaseLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text)', textAlign: 'center' },
  phaseSub: { fontSize: 10, fontWeight: 700 },
  lockedBanner: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: 'var(--red)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600
  },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  progressBar: {
    flex: 1, height: 6, background: 'var(--border)',
    borderRadius: 10, overflow: 'hidden'
  },
  progressFill: {
    height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
    borderRadius: 10, transition: 'width 0.4s ease'
  },
  progressText: { fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' },
  matchGroup: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, overflow: 'hidden'
  },
  matchGroupHeader: {
    background: 'var(--accent-dim)', borderBottom: '1px solid var(--border)',
    padding: '7px 12px', fontSize: 12, fontWeight: 800,
    color: 'var(--accent)', letterSpacing: 1,
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  matchRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
    borderBottom: '1px solid var(--border)'
  },
  team: { flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)' },
  scoreBox: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  scoreIn: {
    width: 40, background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 0', color: 'var(--text)',
    fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none',
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  dash: { color: 'var(--muted)', fontWeight: 700 },
  koNote: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--muted)'
  },
  koMatchRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
    borderBottom: '1px solid var(--border)'
  },
  teamIn: {
    flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 8px', color: 'var(--text)',
    fontSize: 12, outline: 'none', minWidth: 0
  },
  bonusLabel: {
    fontSize: 14, fontWeight: 700, marginBottom: 6, display: 'flex',
    alignItems: 'center', gap: 8
  },
  bonusPts: {
    background: 'var(--accent-dim)', color: 'var(--accent)',
    borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700
  },
  input: {
    background: 'var(--bg)', border: '1.5px solid var(--border)',
    borderRadius: 10, padding: '11px 13px', color: 'var(--text)',
    fontSize: 14, outline: 'none', width: '100%', display: 'block'
  },
  saveBtn: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: 'white', border: 'none', borderRadius: 12, padding: '14px 20px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
    boxShadow: '0 4px 20px var(--accent-glow)', marginTop: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: "'Barlow Condensed', sans-serif"
  },
  lbHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  lbNote: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 12px', fontSize: 11, color: 'var(--muted)'
  },
  refreshBtn: {
    background: 'var(--card)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 8, padding: '6px 10px',
    cursor: 'pointer', fontSize: 16
  },
  lbRow: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10
  },
  lbFirst: {
    border: '1px solid var(--accent)', background: 'var(--accent-dim)',
    boxShadow: '0 0 20px var(--accent-glow)'
  },
  lbRank: { fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 },
  lbAvatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 14, flexShrink: 0
  },
  lbInfo: { flex: 1, minWidth: 0 },
  lbName: { fontWeight: 700, fontSize: 14 },
  lbBreak: { color: 'var(--muted)', fontSize: 11, marginTop: 1 },
  lbTotal: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 22, fontWeight: 900, color: 'var(--accent)', flexShrink: 0
  },
  liveHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fetchBtn: {
    background: 'var(--card)', border: '1px solid var(--border)',
    color: 'var(--accent)', borderRadius: 8, padding: '7px 12px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6
  },
  apiCard: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 14
  },
  apiMsg: { fontSize: 14, color: 'var(--muted)' },
  apiSub: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },
  liveCard: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 12
  },
  liveTeams: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  liveTeam: { flex: 1, fontSize: 12, fontWeight: 600 },
  liveScore: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 20, fontWeight: 900, color: 'var(--accent)', textAlign: 'center', flexShrink: 0
  },
  liveMeta: { color: 'var(--muted)', fontSize: 11, textAlign: 'center', marginTop: 4 },
  adminTabs: { display: 'flex', gap: 6 },
  adminTab: {
    flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '8px 6px', cursor: 'pointer',
    color: 'var(--muted)', fontSize: 12, fontWeight: 600
  },
  adminTabActive: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
    color: 'var(--accent)'
  },
  adminNote: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, padding: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5
  },
  label: { fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, display: 'block' },
  spinner: {
    width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', display: 'inline-block'
  },
}
