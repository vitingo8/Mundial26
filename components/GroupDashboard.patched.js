'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  KNOCKOUT_ROUNDS, SCORING, ALL_TEAMS, PROVISIONAL_TEAMS_NOTE,
  calcLeaderboard, isDeadlinePassed,
} from '../lib/gameData'
import {
  countFilledMatches, buildPointsBreakdown, getUniqueTeamsFromMatches,
  hasAnyPublishedResults, getDefaultPredPhase,
} from '../lib/predictionUtils'
import { PLAYER_SUGGESTIONS } from '../lib/playerSuggestions'
import {
  fetchWcMatchesClient,
  transformGroupMatches,
  transformKnockoutMatches,
  formatMatchDateTime,
  formatGroupLabel,
  formatStageLabel,
  matchStatusLabel,
} from '../lib/footballData'
import TeamCrest from './TeamCrest'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'TIMED'])

export default function GroupDashboard({ group, user, refreshGroup, setCurrentUser, notify, onLeave }) {
  const [tab, setTab] = useState('group')
  const [predPhase, setPredPhase] = useState('group')
  const [groupPreds, setGroupPreds] = useState(user.predictions?.group || {})
  const [koPreds, setKoPreds] = useState(user.predictions?.knockout || {})
  const [bonusPreds, setBonusPreds] = useState(user.predictions?.bonuses || { topScorer: '', topKeeper: '', topAssists: '', mvp: '' })
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved')
  const skipAutoSave = useRef(true)
  const [liveData, setLiveData] = useState([])
  const [apiStatus, setApiStatus] = useState('idle')
  const [apiError, setApiError] = useState(null)
  const [wcMatches, setWcMatches] = useState([])
  const [wcLoading, setWcLoading] = useState(true)
  const [currentGroup, setCurrentGroup] = useState(group)

  const groupMatches = useMemo(() => transformGroupMatches(wcMatches), [wcMatches])
  const knockoutMatches = useMemo(() => transformKnockoutMatches(wcMatches), [wcMatches])

  const leaderboard = calcLeaderboard(currentGroup)
  const isAdmin = user.is_admin
  const groupDeadlinePassed = isDeadlinePassed(currentGroup.group_deadline)
  const koDeadlinePassed = isDeadlinePassed(currentGroup.knockout_deadline)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${origin}?join=${currentGroup.id}`
  const personalUrl = `${origin}?join=${currentGroup.id}&user=${user.id}`
  const teamOptions = useMemo(
    () => getUniqueTeamsFromMatches(groupMatches, knockoutMatches),
    [groupMatches, knockoutMatches]
  )
  const bonusDeadlinePassed = isDeadlinePassed(currentGroup.bonus_deadline)

  async function handleRefresh() {
    const updated = await refreshGroup(currentGroup.id)
    if (updated) setCurrentGroup(updated)
  }

  useEffect(() => {
    let cancelled = false
    async function loadWc() {
      setWcLoading(true)
      try {
        const raw = await fetchWcMatchesClient()
        if (!cancelled) setWcMatches(raw)
      } catch (e) {
        if (!cancelled) console.error('WC matches:', e.message)
      } finally {
        if (!cancelled) setWcLoading(false)
      }
    }
    loadWc()
    return () => { cancelled = true }
  }, [])

  // Auto-refresh leaderboard every 60s
  useEffect(() => {
    const t = setInterval(handleRefresh, 60000)
    return () => clearInterval(t)
  }, [currentGroup.id])

  useEffect(() => {
    setPredPhase(getDefaultPredPhase(currentGroup.phase))
  }, [currentGroup.phase])

  const persistPredictions = useCallback(async (manual = false) => {
    if (groupDeadlinePassed && predPhase === 'group') {
      if (manual) notify('⏰ Plazo de la fase de grupos cerrado', 'warning')
      return
    }
    if (koDeadlinePassed && predPhase === 'knockout') {
      if (manual) notify('⏰ Plazo de eliminatorias cerrado', 'warning')
      return
    }
    if (bonusDeadlinePassed && predPhase === 'bonuses') {
      if (manual) notify('⏰ Plazo de especiales cerrado', 'warning')
      return
    }
    setSaveStatus('saving')
    setSaving(true)
    const predictions = { group: groupPreds, knockout: koPreds, bonuses: bonusPreds }
    const { error } = await supabase
      .from('porra_participants')
      .update({ predictions, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) {
      setSaveStatus('error')
      if (manual) notify('No se pudo guardar. Revisa tu conexión.', 'error')
    } else {
      setSaveStatus('saved')
      if (manual) notify('💾 Predicciones guardadas')
      setCurrentUser({ ...user, predictions })
    }
    setSaving(false)
  }, [
    groupPreds, koPreds, bonusPreds, user, predPhase,
    groupDeadlinePassed, koDeadlinePassed, bonusDeadlinePassed,
    notify, setCurrentUser,
  ])

  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false
      return
    }
    if (tab !== 'predictions') return
    setSaveStatus('pending')
    const t = setTimeout(() => persistPredictions(false), 1000)
    return () => clearTimeout(t)
  }, [groupPreds, koPreds, bonusPreds, tab, persistPredictions])

  useEffect(() => {
    if (tab === 'live' && apiStatus === 'idle' && wcMatches.length > 0) {
      setLiveData(wcMatches)
      setApiStatus('ok')
    }
  }, [tab, wcMatches, apiStatus])

  async function savePredictions() {
    await persistPredictions(true)
  }

  function copyLink(text, msg = '📋 Enlace copiado') {
    navigator.clipboard.writeText(text).then(() => notify(msg))
  }

  async function shareInvite() {
    const text = `¡Únete a la porra "${currentGroup.name}" del Mundial 2026!\n${shareUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Porra Mundial 2026', text, url: shareUrl })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    copyLink(text)
  }

  async function fetchLive() {
    setApiStatus('loading')
    setApiError(null)
    try {
      const raw = await fetchWcMatchesClient()
      setWcMatches(raw)
      setLiveData(raw)
      setApiStatus('ok')
    } catch (e) {
      setApiStatus('unavailable')
      setApiError(e.message)
    }
  }

  const tabs = [
    { id: 'group', icon: '👥', label: 'Grupo' },
    { id: 'predictions', icon: '🎯', label: 'Porra' },
    { id: 'leaderboard', icon: '🏆', label: 'Ranking' },
    { id: 'live', icon: '🔴', label: 'En Vivo' },
    ...(isAdmin ? [{ id: 'admin', icon: '⚙️', label: 'Organización' }] : []),
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
          <div style={s.headerActions}>
            <button type="button" style={s.shareBtn} onClick={shareInvite} aria-label="Compartir invitación">📤</button>
            <button type="button" style={s.shareBtn} onClick={() => copyLink(shareUrl)} aria-label="Copiar enlace del grupo">📋</button>
          </div>
        </div>

        <div style={s.personalLinkBanner}>
          <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>
            Tu enlace personal (guárdalo):
          </span>
          <button type="button" style={s.personalLinkBtn} onClick={() => copyLink(personalUrl, '🔗 Enlace personal copiado')}>
            Copiar
          </button>
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
            <button
              key={t.id}
              type="button"
              aria-label={t.label}
              aria-selected={tab === t.id}
              style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              <span aria-hidden="true">{t.icon}</span>
              <span style={s.tabLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>

        {tab === 'group' && (
          <GroupTab
            group={currentGroup}
            leaderboard={leaderboard}
            shareUrl={shareUrl}
            personalUrl={personalUrl}
            onShare={shareInvite}
            onLeave={onLeave}
            currentUserId={user.id}
          />
        )}

        {tab === 'predictions' && (
          <PredictionsTab
            predPhase={predPhase}
            setPredPhase={setPredPhase}
            groupPreds={groupPreds}
            setGroupPreds={setGroupPreds}
            koPreds={koPreds}
            setKoPreds={setKoPreds}
            bonusPreds={bonusPreds}
            setBonusPreds={setBonusPreds}
            saving={saving}
            saveStatus={saveStatus}
            onSave={savePredictions}
            groupDeadlinePassed={groupDeadlinePassed}
            koDeadlinePassed={koDeadlinePassed}
            bonusDeadlinePassed={bonusDeadlinePassed}
            groupMatches={groupMatches}
            knockoutMatches={knockoutMatches}
            teamOptions={teamOptions.length ? teamOptions : ALL_TEAMS}
            wcLoading={wcLoading}
            groupPhase={currentGroup.phase}
            deadlines={{
              group: currentGroup.group_deadline,
              knockout: currentGroup.knockout_deadline,
              bonus: currentGroup.bonus_deadline,
            }}
          />
        )}

        {tab === 'leaderboard' && (
          <LeaderboardTab
            leaderboard={leaderboard}
            user={user}
            group={currentGroup}
            groupMatches={groupMatches}
            knockoutMatches={knockoutMatches}
            onRefresh={handleRefresh}
          />
        )}

        {tab === 'live' && (
          <LiveTab
            liveData={liveData}
            apiStatus={apiStatus}
            apiError={apiError}
            onFetch={fetchLive}
            wcLoading={wcLoading}
            group={currentGroup}
            groupMatches={groupMatches}
            userPreds={user.predictions}
          />
        )}

        {tab === 'admin' && isAdmin && (
          <AdminTab
            group={currentGroup}
            setGroup={setCurrentGroup}
            refreshGroup={refreshGroup}
            notify={notify}
            groupMatches={groupMatches}
            knockoutMatches={knockoutMatches}
          />
        )}
      </div>
    </div>
  )
}

// ─── GROUP TAB ────────────────────────────────────────────────────────────────
function GroupTab({ group, leaderboard, shareUrl, personalUrl, onShare, onLeave, currentUserId }) {
  return (
    <div style={s.tabContent}>
      <div style={s.inviteCard}>
        <div style={s.inviteText}>
          Invita al grupo:
          <div style={s.shareUrl}>{shareUrl}</div>
        </div>
        <button type="button" style={s.inviteShareBtn} onClick={onShare}>📤 Compartir invitación</button>
      </div>

      <div style={s.inviteCard}>
        <div style={s.inviteText}>
          Tu enlace personal (recuperar sesión):
          <div style={s.shareUrl}>{personalUrl}</div>
        </div>
      </div>

      <SectionTitle>👥 Participantes ({leaderboard.length})</SectionTitle>
      {leaderboard.map((p, i) => (
        <div
          key={p.id}
          style={{
            ...s.participantCard,
            ...(p.id === currentUserId ? { borderColor: 'var(--accent)', background: 'var(--accent-dim)' } : {}),
          }}
        >
          <div style={s.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
          <div style={s.avatar}>{p.name[0].toUpperCase()}</div>
          <div style={s.pInfo}>
            <div style={s.pName}>
              {p.name}
              {p.id === currentUserId && <span style={s.youTag}>Tú</span>}
              {p.is_admin && <span style={s.adminTag}>Organizador</span>}
            </div>
          </div>
          <div style={s.pPts}>{p.total} <span style={{ fontSize: 11, color: 'var(--muted)' }}>pts</span></div>
        </div>
      ))}

      <button type="button" style={s.leaveBtn} onClick={onLeave}>← Salir del grupo</button>
    </div>
  )
}

// ─── PREDICTIONS TAB ──────────────────────────────────────────────────────────
function SaveStatusBar({ status }) {
  const labels = {
    saved: '✓ Guardado',
    saving: 'Guardando…',
    pending: 'Cambios sin guardar…',
    error: '⚠ Error al guardar',
  }
  const colors = {
    saved: 'var(--green)',
    saving: 'var(--muted)',
    pending: 'var(--yellow)',
    error: 'var(--red)',
  }
  return (
    <div style={{ ...s.saveStatus, color: colors[status] || 'var(--muted)' }}>
      {status === 'saving' && <span style={s.spinnerSmall} />}
      {labels[status] || labels.saved}
    </div>
  )
}

function PredictionsTab({
  predPhase, setPredPhase, groupPreds, setGroupPreds, koPreds, setKoPreds,
  bonusPreds, setBonusPreds, saving, saveStatus, onSave,
  groupDeadlinePassed, koDeadlinePassed, bonusDeadlinePassed,
  groupMatches, knockoutMatches, teamOptions, wcLoading, groupPhase, deadlines,
}) {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = localStorage.getItem('porra_onboarding_seen')
    if (!seen) setShowOnboarding(true)
  }, [])

  function dismissOnboarding(startGroup) {
    localStorage.setItem('porra_onboarding_seen', '1')
    setShowOnboarding(false)
    if (startGroup) setPredPhase('group')
  }

  const phases = [
    { id: 'group', icon: '🏟️', label: 'Grupos', sub: '60%', locked: groupDeadlinePassed },
    { id: 'knockout', icon: '⚔️', label: 'Eliminatorias', sub: '40%', locked: koDeadlinePassed },
    { id: 'bonuses', icon: '⭐', label: 'Especiales', sub: 'Bonus', locked: bonusDeadlinePassed },
  ]

  return (
    <div style={s.tabContent}>
      {showOnboarding && (
        <div style={s.onboardingCard}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>🎯 Rellena tu porra</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
            1. Fase de grupos (60%) · 2. Eliminatorias (40%) · 3. Especiales (bonus).
            Los cambios se guardan solos.
          </p>
          {(deadlines.group || deadlines.knockout) && (
            <p style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 12 }}>
              ⏰ Hay plazos configurados por el organizador.
            </p>
          )}
          <button type="button" style={s.onboardingBtn} onClick={() => dismissOnboarding(true)}>
            Empezar por grupos →
          </button>
          <button type="button" style={s.onboardingSkip} onClick={() => dismissOnboarding(false)}>Cerrar</button>
        </div>
      )}

      <DeadlineBanner deadlines={deadlines} groupPhase={groupPhase} />

      <div style={s.phasePicker}>
        {phases.map(p => (
          <button
            key={p.id}
            type="button"
            style={{ ...s.phaseBtn, ...(predPhase === p.id ? s.phaseActive : {}) }}
            onClick={() => setPredPhase(p.id)}
          >
            <span style={{ fontSize: 20 }}>{p.icon}</span>
            <span style={s.phaseLabel}>{p.label}</span>
            <span style={{ ...s.phaseSub, color: p.locked ? 'var(--red)' : 'var(--accent-dark)' }}>
              {p.locked ? '🔒' : p.sub}
            </span>
          </button>
        ))}
      </div>

      <SaveStatusBar status={saveStatus} />

      {wcLoading && predPhase === 'group' && (
        <div style={s.apiCard}>
          <div style={s.apiMsg}>Cargando calendario FIFA 2026…</div>
        </div>
      )}
      {predPhase === 'group' && (
        <GroupPhasePreds preds={groupPreds} setPreds={setGroupPreds} locked={groupDeadlinePassed} matches={groupMatches} />
      )}
      {predPhase === 'knockout' && (
        <KnockoutPreds preds={koPreds} setPreds={setKoPreds} locked={koDeadlinePassed} matches={knockoutMatches} teamOptions={teamOptions} />
      )}
      {predPhase === 'bonuses' && (
        <BonusPreds preds={bonusPreds} setPreds={setBonusPreds} locked={bonusDeadlinePassed} />
      )}

      <button type="button" style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={onSave} disabled={saving}>
        {saving ? <span style={s.spinner} /> : '💾'} Guardar ahora
      </button>
    </div>
  )
}

function DeadlineBanner({ deadlines, groupPhase }) {
  const items = []
  if (deadlines.group) items.push({ label: 'Grupos', d: deadlines.group })
  if (deadlines.knockout) items.push({ label: 'Eliminatorias', d: deadlines.knockout })
  if (deadlines.bonus) items.push({ label: 'Especiales', d: deadlines.bonus })
  if (!items.length) return null
  return (
    <div style={s.deadlineBanner}>
      <span>Fase torneo: <strong>{groupPhase === 'knockout' ? 'Eliminatorias' : groupPhase === 'finished' ? 'Finalizado' : 'Grupos'}</strong></span>
      {items.map(i => (
        <span key={i.label} style={{ fontSize: 11 }}>
          {i.label}: {new Date(i.d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      ))}
    </div>
  )
}

function GroupPhasePreds({ preds, setPreds, locked, matches = [] }) {
  const groups = [...new Set(matches.map(m => m.group).filter(Boolean))].sort()
  const [filterGroup, setFilterGroup] = useState(null)
  const [onlyPending, setOnlyPending] = useState(false)

  const byGroup = {}
  matches.forEach(m => {
    if (!byGroup[m.group]) byGroup[m.group] = []
    byGroup[m.group].push(m)
  })

  function setScore(id, side, val) {
    const v = parseInt(val, 10)
    if (isNaN(v) || v < 0 || v > 20) return
    setPreds(p => ({ ...p, [id]: { ...p[id], [side]: v } }))
  }

  function applyShortcut(id, home, away) {
    if (locked) return
    setPreds(p => ({ ...p, [id]: { home, away } }))
  }

  const filled = countFilledMatches(preds, matches)
  const total = matches.length || 1

  function nextIncompleteGroup() {
    for (const g of groups) {
      const ms = byGroup[g] || []
      if (ms.some(m => !countFilledMatches(preds, [m]))) {
        setFilterGroup(g)
        return
      }
    }
  }

  if (!matches.length) {
    return (
      <div style={s.apiCard}>
        <div style={s.apiMsg}>No hay partidos de grupos. Comprueba FOOTBALL_DATA_API_KEY en el servidor.</div>
        <div style={s.apiSub}>{PROVISIONAL_TEAMS_NOTE}</div>
      </div>
    )
  }

  const visibleGroups = Object.entries(byGroup).filter(([grp, ms]) => {
    if (filterGroup && grp !== filterGroup) return false
    if (onlyPending && !ms.some(m => !countFilledMatches(preds, [m]))) return false
    return true
  })

  return (
    <div>
      {locked && <div style={s.lockedBanner}>🔒 Plazo cerrado · Solo lectura</div>}
      <div style={s.progressWrap}>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${Math.round(filled / total * 100)}%` }} />
        </div>
        <span style={s.progressText}>{filled}/{total} partidos</span>
      </div>

      <div style={s.filterRow}>
        <button type="button" style={{ ...s.chip, ...(!filterGroup ? s.chipActive : {}) }} onClick={() => setFilterGroup(null)}>Todos</button>
        {groups.map(g => (
          <button key={g} type="button" style={{ ...s.chip, ...(filterGroup === g ? s.chipActive : {}) }} onClick={() => setFilterGroup(g === filterGroup ? null : g)}>
            {g}
          </button>
        ))}
      </div>
      <div style={s.toolbarRow}>
        <label style={s.toggleLabel}>
          <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} />
          Solo pendientes
        </label>
        <button type="button" style={s.linkBtn} onClick={nextIncompleteGroup}>Siguiente incompleto →</button>
      </div>

      {visibleGroups.map(([grp, grpMatches]) => (
        <div key={grp} style={s.matchGroup}>
          <div style={s.matchGroupHeader}>Grupo {grp}</div>
          {(onlyPending ? grpMatches.filter(m => !countFilledMatches(preds, [m])) : grpMatches).map(m => (
              <MatchRow
                key={m.id}
                home={m.home}
                away={m.away}
                homeCrest={m.homeCrest}
                awayCrest={m.awayCrest}
                meta={formatMatchDateTime(m.utcDate) + (m.venue ? ` · ${m.venue}` : '')}
                homeVal={preds[m.id]?.home ?? ''}
                awayVal={preds[m.id]?.away ?? ''}
                onHome={v => setScore(m.id, 'home', v)}
                onAway={v => setScore(m.id, 'away', v)}
                onShortcut={(h, a) => applyShortcut(m.id, h, a)}
                locked={locked}
              />
          ))}
        </div>
      ))}
    </div>
  )
}

function TeamSelect({ value, onChange, options, disabled, placeholder }) {
  return (
    <select
      style={s.teamSelect}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder || 'Equipo'}</option>
      {options.map(t => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}

function KnockoutPreds({ preds, setPreds, locked, matches = [], teamOptions = [] }) {
  function setVal(id, key, val) {
    const v = key === 'home' || key === 'away' ? parseInt(val, 10) : val
    if ((key === 'home' || key === 'away') && (isNaN(v) || v < 0)) return
    setPreds(p => ({ ...p, [id]: { ...p[id], [key]: v } }))
  }

  const byRound = {}
  matches.forEach(m => {
    if (!byRound[m.roundId]) byRound[m.roundId] = { label: m.roundLabel, items: [] }
    byRound[m.roundId].items.push(m)
  })

  if (matches.length > 0) {
    return (
      <div>
        {locked && <div style={s.lockedBanner}>🔒 Plazo cerrado · Solo lectura</div>}
        {Object.entries(byRound).map(([roundId, { label, items }]) => (
          <div key={roundId} style={s.matchGroup}>
            <div style={s.matchGroupHeader}>🏆 {label}</div>
            {items.map(m => (
              <MatchRow
                key={m.id}
                home={m.home}
                away={m.away}
                homeCrest={m.homeCrest}
                awayCrest={m.awayCrest}
                meta={formatMatchDateTime(m.utcDate) + (m.venue ? ` · ${m.venue}` : '')}
                homeVal={preds[m.id]?.home ?? ''}
                awayVal={preds[m.id]?.away ?? ''}
                onHome={v => setVal(m.id, 'home', v)}
                onAway={v => setVal(m.id, 'away', v)}
                locked={locked}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const opts = teamOptions.length ? teamOptions : ALL_TEAMS

  return (
    <div>
      {locked && <div style={s.lockedBanner}>🔒 Plazo cerrado · Solo lectura</div>}
      <div style={s.koNote}>
        Calendario no disponible. Elige equipos de la lista y marca resultado.
      </div>
      {KNOCKOUT_ROUNDS.map(round => (
        <div key={round.id} style={s.matchGroup}>
          <div style={s.matchGroupHeader}>{round.emoji} {round.label}</div>
          {Array.from({ length: round.matches }).map((_, i) => {
            const id = `${round.id}-${i}`
            return (
              <div key={id} style={s.koMatchRow}>
                <TeamSelect
                  value={preds[id]?.homeTeam || ''}
                  onChange={v => setVal(id, 'homeTeam', v)}
                  options={opts}
                  disabled={locked}
                  placeholder="Local"
                />
                <div style={s.scoreBox}>
                  <input type="number" style={s.scoreIn} value={preds[id]?.home ?? ''} onChange={e => setVal(id, 'home', e.target.value)} placeholder="0" disabled={locked} />
                  <span style={s.dash}>-</span>
                  <input type="number" style={s.scoreIn} value={preds[id]?.away ?? ''} onChange={e => setVal(id, 'away', e.target.value)} placeholder="0" disabled={locked} />
                </div>
                <TeamSelect
                  value={preds[id]?.awayTeam || ''}
                  onChange={v => setVal(id, 'awayTeam', v)}
                  options={opts}
                  disabled={locked}
                  placeholder="Visitante"
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function BonusPreds({ preds, setPreds, locked }) {
  const fields = [
    { id: 'topScorer', label: '⚽ Máximo goleador', pts: 5 },
    { id: 'topKeeper', label: '🧤 Mejor portero', pts: 5 },
    { id: 'topAssists', label: '🅰️ Máximo asistente', pts: 5 },
    { id: 'mvp', label: '⭐ MVP del torneo', pts: 10 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {locked && <div style={s.lockedBanner}>🔒 Plazo cerrado · Solo lectura</div>}
      {fields.map(f => (
        <div key={f.id}>
          <div style={s.bonusLabel}>
            {f.label} <span style={s.bonusPts}>+{f.pts} pts</span>
          </div>
          <input
            style={s.input}
            list="player-suggestions"
            placeholder="Nombre del jugador"
            value={preds[f.id] || ''}
            onChange={e => setPreds(p => ({ ...p, [f.id]: e.target.value }))}
            disabled={locked}
          />
        </div>
      ))}
      <datalist id="player-suggestions">
        {PLAYER_SUGGESTIONS.map(p => <option key={p} value={p} />)}
      </datalist>
    </div>
  )
}

const SCORE_SHORTCUTS = [[0, 0], [1, 0], [1, 1], [2, 1]]

function MatchRow({ home, away, homeCrest, awayCrest, meta, homeVal, awayVal, onHome, onAway, onShortcut, locked }) {
  return (
    <div style={s.matchRowWrap}>
      <div style={s.matchRow}>
        <div style={s.teamCell}>
          <TeamCrest src={homeCrest} alt={home} size={22} />
          <span style={s.team}>{home}</span>
        </div>
        <div style={s.scoreBox}>
          <input type="number" style={s.scoreIn} value={homeVal} onChange={e => onHome(e.target.value)} placeholder="-" disabled={locked} aria-label={`Goles ${home}`} />
          <span style={s.dash}>-</span>
          <input type="number" style={s.scoreIn} value={awayVal} onChange={e => onAway(e.target.value)} placeholder="-" disabled={locked} aria-label={`Goles ${away}`} />
        </div>
        <div style={{ ...s.teamCell, justifyContent: 'flex-end' }}>
          <span style={{ ...s.team, textAlign: 'right' }}>{away}</span>
          <TeamCrest src={awayCrest} alt={away} size={22} />
        </div>
      </div>
      {onShortcut && !locked && (
        <div style={s.shortcutRow}>
          {SCORE_SHORTCUTS.map(([h, a]) => (
            <button key={`${h}-${a}`} type="button" style={s.shortcutBtn} onClick={() => onShortcut(h, a)}>
              {h}-{a}
            </button>
          ))}
        </div>
      )}
      {meta && <div style={s.matchMeta}>{meta}</div>}
    </div>
  )
}

// ─── LEADERBOARD TAB ──────────────────────────────────────────────────────────
function LeaderboardTab({ leaderboard, user, group, groupMatches, knockoutMatches, onRefresh }) {
  const [showPoints, setShowPoints] = useState(false)
  const breakdown = buildPointsBreakdown(user, group, groupMatches, knockoutMatches)
  const leader = leaderboard[0]
  const me = leaderboard.find(p => p.id === user.id)
  const gap = leader && me ? Math.round((leader.total - me.total) * 10) / 10 : 0
  const hasResults = hasAnyPublishedResults(group)

  return (
    <div style={s.tabContent}>
      <div style={s.lbHeader}>
        <SectionTitle>🏆 Clasificación</SectionTitle>
        <button type="button" style={s.refreshBtn} onClick={onRefresh} aria-label="Actualizar ranking">🔄</button>
      </div>
      <div style={s.lbNote}>Grupos ×0.6 + Eliminatorias ×0.4 + Especiales</div>

      {!hasResults && (
        <div style={s.apiCard}>
          <div style={s.apiMsg}>El ranking se activará cuando el organizador publique resultados.</div>
        </div>
      )}

      {me && leader && me.id !== leader.id && hasResults && (
        <div style={s.gapBanner}>Estás a <strong>{gap} pts</strong> del líder ({leader.name})</div>
      )}

      {leaderboard.map((p, i) => (
        <div
          key={p.id}
          style={{
            ...s.lbRow,
            ...(i === 0 ? s.lbFirst : {}),
            ...(p.id === user.id ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent-glow)' } : {}),
          }}
        >
          <div style={s.lbRank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
          <div style={s.lbAvatar}>{p.name[0].toUpperCase()}</div>
          <div style={s.lbInfo}>
            <div style={s.lbName}>
              {p.name}
              {p.id === user.id && <span style={s.youTag}>Tú</span>}
            </div>
            <div style={s.lbBreak}>
              Gr: {Math.round(p.groupPts * 0.6 * 10) / 10} · KO: {Math.round(p.knockoutPts * 0.4 * 10) / 10} · Esp: {p.bonusPts}
            </div>
          </div>
          <div style={s.lbTotal}>
            {p.total}
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}> pts</span>
          </div>
        </div>
      ))}
      {leaderboard.length === 0 && <EmptyState text="Sin participantes todavía" />}

      <button type="button" style={s.pointsToggle} onClick={() => setShowPoints(v => !v)}>
        {showPoints ? 'Ocultar' : 'Ver'} mis puntos ({breakdown.length})
      </button>
      {showPoints && (
        <div style={s.pointsList}>
          {breakdown.length === 0 ? (
            <EmptyState text="Aún no hay puntos — espera a que se publiquen resultados" />
          ) : (
            breakdown.map(item => (
              <div key={`${item.phase}-${item.id}`} style={s.pointsRow}>
                <div style={s.pointsLabel}>{item.label}</div>
                <div style={s.pointsDetail}>
                  Tu: {item.pred} · Real: {item.real} · <strong>+{item.pts}</strong>
                  {item.detail ? ` (${item.detail})` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── LIVE TAB ─────────────────────────────────────────────────────────────────
function AdminResultsFallback({ group, groupMatches, userPreds }) {
  const withResults = groupMatches.filter(m => {
    const r = group.results?.group?.[m.id]
    return r && r.home != null && r.away != null
  })
  if (!withResults.length) return null
  return (
    <>
      <SectionTitle>📋 Resultados del organizador</SectionTitle>
      {withResults.slice(0, 25).map(m => {
        const r = group.results.group[m.id]
        const pred = userPreds?.group?.[m.id]
        return (
          <div key={m.id} style={s.liveCard}>
            <div style={s.liveTeams}>
              <span style={s.liveTeam}>{m.home}</span>
              <span style={s.liveScore}>{r.home} - {r.away}</span>
              <span style={{ ...s.liveTeam, textAlign: 'right' }}>{m.away}</span>
            </div>
            {pred && (
              <div style={s.liveMeta}>
                Tu predicción: {pred.home ?? '?'}-{pred.away ?? '?'}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function LiveTab({ liveData, apiStatus, apiError, onFetch, wcLoading, group, groupMatches, userPreds }) {
  const finished = liveData.filter(m => m.status === 'FINISHED')
  const live = liveData.filter(m => LIVE_STATUSES.has(m.status))
  const upcoming = liveData.filter(m => UPCOMING_STATUSES.has(m.status)).slice(0, 15)
  const showFallback = apiStatus === 'unavailable' || (apiStatus === 'idle' && !wcLoading && liveData.length === 0)

  return (
    <div style={s.tabContent}>
      <div style={s.liveHeader}>
        <SectionTitle>🔴 Resultados en Vivo</SectionTitle>
        <button style={s.fetchBtn} onClick={onFetch} disabled={apiStatus === 'loading'}>
          {apiStatus === 'loading' ? <span style={s.spinner} /> : '🔄'} Actualizar
        </button>
      </div>

      {apiStatus === 'idle' && !wcLoading && liveData.length === 0 && (
        <div style={s.apiCard}>
          <div style={s.apiMsg}>Pulsa "Actualizar" para cargar el calendario FIFA 2026</div>
          <div style={s.apiSub}>Datos oficiales vía football-data.org (competición WC)</div>
        </div>
      )}
      {wcLoading && apiStatus !== 'loading' && (
        <div style={s.apiCard}>
          <div style={s.apiMsg}>Cargando 104 partidos del Mundial…</div>
        </div>
      )}
      {apiStatus === 'unavailable' && (
        <div style={{ ...s.apiCard, borderColor: 'var(--yellow-border)' }}>
          <div style={{ color: 'var(--yellow)' }}>⚠️ API en vivo no disponible</div>
          <div style={s.apiSub}>{apiError || 'Configura FOOTBALL_DATA_API_KEY. Mostrando resultados del organizador si existen.'}</div>
        </div>
      )}
      {showFallback && (
        <AdminResultsFallback group={group} groupMatches={groupMatches} userPreds={userPreds} />
      )}
      {apiStatus === 'ok' && (
        <div style={{ ...s.apiCard, borderColor: 'var(--green-border)' }}>
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
  const isUpcoming = upcoming || UPCOMING_STATUSES.has(m.status)
  const home = m.homeTeam?.shortName || m.homeTeam?.name
  const away = m.awayTeam?.shortName || m.awayTeam?.name
  const groupInfo = m.group ? formatGroupLabel(m.group) : formatStageLabel(m.stage)

  return (
    <div style={{
      ...s.liveCard,
      ...(highlight ? { borderColor: 'var(--accent)', animation: 'glow 2s ease infinite' } : {})
    }}>
      <div style={s.liveTeams}>
        <div style={s.liveTeamSide}>
          <TeamCrest src={m.homeTeam?.crest} alt={home} size={28} />
          <span style={s.liveTeam}>{home}</span>
        </div>
        <div style={s.liveCenter}>
          <span style={s.liveScore}>
            {isUpcoming
              ? formatMatchDateTime(m.utcDate)
              : `${m.score?.fullTime?.home ?? '-'} - ${m.score?.fullTime?.away ?? '-'}`
            }
          </span>
          {!isUpcoming && m.utcDate && (
            <span style={s.liveTimeSub}>{formatMatchDateTime(m.utcDate)}</span>
          )}
        </div>
        <div style={{ ...s.liveTeamSide, justifyContent: 'flex-end' }}>
          <span style={{ ...s.liveTeam, textAlign: 'right' }}>{away}</span>
          <TeamCrest src={m.awayTeam?.crest} alt={away} size={28} />
        </div>
      </div>
      <div style={s.liveMeta}>
        {groupInfo}
        {m.matchday ? ` · J${m.matchday}` : ''}
        {m.venue ? ` · 📍 ${m.venue}` : ''}
        {' · '}
        {matchStatusLabel(m.status, highlight, isUpcoming)}
      </div>
    </div>
  )
}

// ─── ADMIN TAB ────────────────────────────────────────────────────────────────
function AdminTab({ group, setGroup, refreshGroup, notify, groupMatches = [], knockoutMatches = [] }) {
  const [adminTab, setAdminTab] = useState('deadlines')
  const [groupDeadline, setGroupDeadline] = useState(group.group_deadline ? group.group_deadline.slice(0, 16) : '')
  const [koDeadline, setKoDeadline] = useState(group.knockout_deadline ? group.knockout_deadline.slice(0, 16) : '')
  const [bonusDeadline, setBonusDeadline] = useState(group.bonus_deadline ? group.bonus_deadline.slice(0, 16) : '')
  const [tournamentPhase, setTournamentPhase] = useState(group.phase || 'group')
  const [results, setResults] = useState(group.results || { group: {}, knockout: {} })
  const [actuals, setActuals] = useState(group.actuals || {})
  const [saving, setSaving] = useState(false)

  const groupResultsCount = groupMatches.filter(m => {
    const r = results.group?.[m.id]
    return r && r.home != null && r.away != null
  }).length

  const koResultsCount = knockoutMatches.filter(m => {
    const r = results.knockout?.[m.id]
    return r && r.home != null && r.away != null
  }).length

  async function saveDeadlines() {
    setSaving(true)
    const { error } = await supabase.from('porra_groups').update({
      group_deadline: groupDeadline || null,
      knockout_deadline: koDeadline || null,
      bonus_deadline: bonusDeadline || null,
      phase: tournamentPhase,
    }).eq('id', group.id)
    if (error) notify('Error: ' + error.message, 'error')
    else { notify('✅ Plazos guardados'); const g = await refreshGroup(group.id); if (g) setGroup(g) }
    setSaving(false)
  }

  async function saveResults(which = 'all') {
    setSaving(true)
    const payload = which === 'actuals' ? { actuals } : which === 'group' ? { results } : which === 'knockout' ? { results } : { results, actuals }
    const { error } = await supabase.from('porra_groups').update(payload).eq('id', group.id)
    if (error) notify('No se pudo guardar.', 'error')
    else {
      notify('✅ Guardado')
      const g = await refreshGroup(group.id)
      if (g) setGroup(g)
    }
    setSaving(false)
  }

  function setGroupResult(id, side, val) {
    const v = parseInt(val, 10)
    if (isNaN(v) || v < 0) return
    setResults(r => ({ ...r, group: { ...r.group, [id]: { ...r.group[id], [side]: v } } }))
  }

  function setKoResult(id, side, val) {
    const v = parseInt(val, 10)
    if (isNaN(v) || v < 0) return
    setResults(r => ({ ...r, knockout: { ...r.knockout, [id]: { ...r.knockout[id], [side]: v } } }))
  }

  const byGroup = {}
  groupMatches.forEach(m => {
    if (!byGroup[m.group]) byGroup[m.group] = []
    byGroup[m.group].push(m)
  })

  return (
    <div style={s.tabContent}>
      <SectionTitle>⚙️ Panel de Administración</SectionTitle>
      <div style={s.adminTabs}>
        {[
          { id: 'deadlines', label: '⏰ Plazos' },
          { id: 'results', label: '📊 Grupos' },
          { id: 'knockout', label: '⚔️ Eliminatorias' },
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
            <label style={s.label} htmlFor="admin-ko-deadline">⏰ Fecha tope eliminatorias (40%)</label>
            <input id="admin-ko-deadline" type="datetime-local" style={s.input} value={koDeadline} onChange={e => setKoDeadline(e.target.value)} />
          </div>
          <div>
            <label style={s.label} htmlFor="admin-bonus-deadline">⏰ Fecha tope especiales</label>
            <input id="admin-bonus-deadline" type="datetime-local" style={s.input} value={bonusDeadline} onChange={e => setBonusDeadline(e.target.value)} />
          </div>
          <div>
            <label style={s.label} htmlFor="admin-phase">Fase del torneo (UI porra)</label>
            <select id="admin-phase" style={s.input} value={tournamentPhase} onChange={e => setTournamentPhase(e.target.value)}>
              <option value="group">Fase de grupos</option>
              <option value="knockout">Eliminatorias</option>
              <option value="finished">Finalizado</option>
            </select>
          </div>
          <button type="button" style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={saveDeadlines} disabled={saving}>
            {saving ? <span style={s.spinner} /> : '💾'} Guardar plazos
          </button>
        </div>
      )}

      {adminTab === 'results' && (
        <div>
          <div style={s.adminNote}>
            Resultados fase de grupos · {groupResultsCount}/{groupMatches.length} introducidos
          </div>
          {Object.entries(byGroup).map(([grp, matches]) => (
            <div key={grp} style={s.matchGroup}>
              <div style={s.matchGroupHeader}>Grupo {grp}</div>
              {matches.map(m => (
                <MatchRow key={m.id}
                  home={m.home} away={m.away}
                  homeCrest={m.homeCrest} awayCrest={m.awayCrest}
                  meta={formatMatchDateTime(m.utcDate)}
                  homeVal={results.group?.[m.id]?.home ?? ''}
                  awayVal={results.group?.[m.id]?.away ?? ''}
                  onHome={v => setGroupResult(m.id, 'home', v)}
                  onAway={v => setGroupResult(m.id, 'away', v)}
                  locked={false}
                />
              ))}
            </div>
          ))}
          <button type="button" style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={() => saveResults('group')} disabled={saving}>
            {saving ? <span style={s.spinner} /> : '💾'} Guardar resultados grupos
          </button>
        </div>
      )}

      {adminTab === 'knockout' && (
        <div>
          <div style={s.adminNote}>
            Resultados eliminatorias · {koResultsCount}/{knockoutMatches.length || '—'} introducidos
          </div>
          {knockoutMatches.length > 0 ? (
            knockoutMatches.map(m => (
              <MatchRow
                key={m.id}
                home={m.home}
                away={m.away}
                homeCrest={m.homeCrest}
                awayCrest={m.awayCrest}
                meta={formatMatchDateTime(m.utcDate)}
                homeVal={results.knockout?.[m.id]?.home ?? ''}
                awayVal={results.knockout?.[m.id]?.away ?? ''}
                onHome={v => setKoResult(m.id, 'home', v)}
                onAway={v => setKoResult(m.id, 'away', v)}
                locked={false}
              />
            ))
          ) : (
            KNOCKOUT_ROUNDS.map(round => (
              <div key={round.id} style={s.matchGroup}>
                <div style={s.matchGroupHeader}>{round.emoji} {round.label}</div>
                {Array.from({ length: round.matches }).map((_, i) => {
                  const id = `${round.id}-${i}`
                  return (
                    <MatchRow
                      key={id}
                      home={`${round.label} · local ${i + 1}`}
                      away={`${round.label} · visit. ${i + 1}`}
                      homeVal={results.knockout?.[id]?.home ?? ''}
                      awayVal={results.knockout?.[id]?.away ?? ''}
                      onHome={v => setKoResult(id, 'home', v)}
                      onAway={v => setKoResult(id, 'away', v)}
                      locked={false}
                    />
                  )
                })}
              </div>
            ))
          )}
          <button type="button" style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={() => saveResults('knockout')} disabled={saving}>
            {saving ? <span style={s.spinner} /> : '💾'} Guardar eliminatorias
          </button>
        </div>
      )}

      {adminTab === 'actuals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.adminNote}>Introduce los ganadores reales para otorgar las bonificaciones.</div>
          {[
            { id: 'topScorer', label: '⚽ Máximo Goleador Real' },
            { id: 'topKeeper', label: '🧤 Mejor portero real' },
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
          <button type="button" style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={() => saveResults('actuals')} disabled={saving}>
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
      borderColor: passed ? 'var(--red-border)' : 'var(--accent-glow)',
      color: passed ? 'var(--red)' : 'var(--accent-dark)'
    }}>
      {passed ? '🔒' : '⏰'} {label}: {d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  header: {
    background: 'var(--glass)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50,
    boxShadow: '0 4px 20px rgba(29, 49, 38, 0.08)'
  },
  headerTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '14px 16px 8px', gap: 12
  },
  groupName: {
    fontSize: 22, fontWeight: 900, letterSpacing: 0.5
  },
  groupMeta: { display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  codeTag: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    color: 'var(--accent-dark)', borderRadius: 20, padding: '2px 10px',
    fontSize: 11, fontWeight: 700, letterSpacing: 1
  },
  userTag: { fontSize: 11, color: 'var(--muted)', alignSelf: 'center' },
  headerActions: { display: 'flex', gap: 6, flexShrink: 0 },
  shareBtn: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    color: 'var(--accent-dark)', borderRadius: 10, padding: '8px 12px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  personalLinkBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 16px 8px', flexWrap: 'wrap',
  },
  personalLinkBtn: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700,
    cursor: 'pointer', color: 'var(--accent-dark)',
  },
  inviteShareBtn: {
    marginTop: 10, width: '100%',
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    borderRadius: 10, padding: '10px', fontWeight: 700, cursor: 'pointer',
    color: 'var(--accent-dark)', fontSize: 13,
  },
  youTag: {
    background: 'var(--accent)', color: 'white',
    borderRadius: 8, padding: '1px 6px', fontSize: 10, fontWeight: 700,
  },
  saveStatus: {
    fontSize: 12, fontWeight: 700, textAlign: 'center', padding: '4px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  spinnerSmall: {
    width: 12, height: 12, border: '2px solid var(--border)',
    borderTopColor: 'var(--accent)', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },
  onboardingCard: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    borderRadius: 14, padding: 16,
  },
  onboardingBtn: {
    width: '100%', background: 'var(--accent-dark)', color: 'white',
    border: 'none', borderRadius: 10, padding: '12px', fontWeight: 700, cursor: 'pointer',
  },
  onboardingSkip: {
    width: '100%', background: 'transparent', border: 'none',
    color: 'var(--muted)', marginTop: 8, cursor: 'pointer', fontSize: 12,
  },
  deadlineBanner: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, padding: 10, fontSize: 12, color: 'var(--muted)',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', overflowX: 'auto' },
  chip: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', color: 'var(--muted)',
  },
  chipActive: {
    background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent-dark)',
  },
  toolbarRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
  },
  toggleLabel: { fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 },
  linkBtn: {
    background: 'none', border: 'none', color: 'var(--accent-dark)',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  shortcutRow: { display: 'flex', gap: 4, padding: '0 12px 8px', flexWrap: 'wrap' },
  shortcutBtn: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700,
    cursor: 'pointer', color: 'var(--muted)',
  },
  teamSelect: {
    flex: 1, minWidth: 0, background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 6px', fontSize: 11, color: 'var(--text)',
  },
  gapBanner: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)',
    borderRadius: 10, padding: 10, fontSize: 13, textAlign: 'center',
  },
  pointsToggle: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px', width: '100%', fontWeight: 700,
    cursor: 'pointer', color: 'var(--accent-dark)',
  },
  pointsList: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
  },
  pointsRow: { borderBottom: '1px solid var(--border)', paddingBottom: 8 },
  pointsLabel: { fontWeight: 700, fontSize: 13 },
  pointsDetail: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
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
  tabActive: { color: 'var(--accent-dark)', borderBottomColor: 'var(--accent)' },
  tabLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  content: { flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: '16px 16px 100px' },
  tabContent: { display: 'flex', flexDirection: 'column', gap: 14 },
  inviteCard: {
    background: 'var(--accent-dim)', border: '1px solid var(--border-strong)',
    borderRadius: 14, padding: 14
  },
  inviteText: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 },
  shareUrl: {
    color: 'var(--accent-dark)', fontSize: 12, wordBreak: 'break-all',
    marginTop: 4, fontWeight: 600
  },
  sectionTitle: {
    fontSize: 17, fontWeight: 800, letterSpacing: 0.3, color: 'var(--text)'
  },
  participantCard: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10
  },
  rank: { fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 },
  avatar: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-dark), var(--accent))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15, flexShrink: 0
  },
  pInfo: { flex: 1, minWidth: 0 },
  pName: { fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 },
  pMeta: { color: 'var(--muted)', fontSize: 11, marginTop: 1 },
  pPts: { fontSize: 20, fontWeight: 900, color: 'var(--accent-dark)', flexShrink: 0 },
  adminTag: {
    background: 'var(--accent-dim)', color: 'var(--accent-dark)',
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
    background: 'var(--red-dim)', border: '1px solid var(--red-border)',
    color: 'var(--red)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600
  },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 10 },
  progressBar: {
    flex: 1, height: 6, background: 'var(--border)',
    borderRadius: 10, overflow: 'hidden'
  },
  progressFill: {
    height: '100%', background: 'linear-gradient(90deg, var(--accent-dark), var(--accent2))',
    borderRadius: 10, transition: 'width 0.4s ease'
  },
  progressText: { fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' },
  matchGroup: {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--card-shadow)'
  },
  matchGroupHeader: {
    background: 'var(--accent-dim)', borderBottom: '1px solid var(--border)',
    padding: '7px 12px', fontSize: 12, fontWeight: 800,
    color: 'var(--accent-dark)', letterSpacing: 1,
  },
  matchRowWrap: {
    borderBottom: '1px solid var(--border)',
  },
  matchRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
  },
  matchMeta: {
    fontSize: 10, color: 'var(--muted)', padding: '0 12px 8px',
  },
  teamCell: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
  },
  team: { flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)', minWidth: 0 },
  scoreBox: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  scoreIn: {
    width: 40, background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '5px 0', color: 'var(--text)',
    fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none',
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
    background: 'var(--accent-dim)', color: 'var(--accent-dark)',
    borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700
  },
  input: {
    background: 'var(--bg)', border: '1.5px solid var(--border)',
    borderRadius: 10, padding: '11px 13px', color: 'var(--text)',
    fontSize: 14, outline: 'none', width: '100%', display: 'block'
  },
  saveBtn: {
    background: 'linear-gradient(135deg, var(--accent-dark), var(--accent))',
    color: 'white', border: 'none', borderRadius: 12, padding: '14px 20px',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
    boxShadow: '0 4px 20px var(--accent-glow)', marginTop: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
    boxShadow: '0 4px 20px var(--accent-glow)'
  },
  lbRank: { fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 },
  lbAvatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-dark), var(--accent))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 14, flexShrink: 0
  },
  lbInfo: { flex: 1, minWidth: 0 },
  lbName: { fontWeight: 700, fontSize: 14 },
  lbBreak: { color: 'var(--muted)', fontSize: 11, marginTop: 1 },
  lbTotal: {
    fontSize: 22, fontWeight: 900, color: 'var(--accent-dark)', flexShrink: 0
  },
  liveHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fetchBtn: {
    background: 'var(--card)', border: '1px solid var(--border)',
    color: 'var(--accent-dark)', borderRadius: 8, padding: '7px 12px',
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
  liveTeamSide: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  liveTeam: { fontSize: 12, fontWeight: 600, minWidth: 0 },
  liveCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: 2 },
  liveScore: {
    fontSize: 15, fontWeight: 800, color: 'var(--accent-dark)', textAlign: 'center',
  },
  liveTimeSub: { fontSize: 10, color: 'var(--muted)' },
  liveMeta: { color: 'var(--muted)', fontSize: 11, textAlign: 'center', marginTop: 4 },
  adminTabs: { display: 'flex', gap: 6 },
  adminTab: {
    flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '8px 6px', cursor: 'pointer',
    color: 'var(--muted)', fontSize: 12, fontWeight: 600
  },
  adminTabActive: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
    color: 'var(--accent-dark)'
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
