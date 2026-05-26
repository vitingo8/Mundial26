'use client'
import Link from 'next/link'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getStoredWriteToken } from '../lib/sessionToken'
import { migratePredictionMap, countOrphanPredKeys } from '../lib/matchIdMap'
import { isPhaseLocked, msUntilDeadline, formatCountdown } from '../lib/phaseLock'
import { usePredictions } from '../hooks/usePredictions'
import { useWcMatches } from '../hooks/useWcMatches'
import { useAutoSyncResults } from '../hooks/useAutoSyncResults'
import { countFinishedFromApi } from '../lib/syncResultsFromApi'

import {
  KNOCKOUT_ROUNDS, SCORING, ALL_TEAMS, PROVISIONAL_TEAMS_NOTE,
  calcLeaderboard, isDeadlinePassed,
} from '../lib/gameData'
import {
  countFilledMatches, getUniqueTeamsFromMatches,
  hasAnyPublishedResults, getDefaultPredPhase, getAdminTaskBadges,
  enrichLeaderboardWithStats,
} from '../lib/predictionUtils'
import GroupStatsTable from './dashboard/GroupStatsTable'
import ProfileTab from './ProfileTab'
import ParticipantDisplay, { ParticipantAvatar } from './ParticipantDisplay'
import { readScheduleViewMode, writeScheduleViewMode, resizeLogoFile } from '../lib/participantProfile'
import LeagueLogo from './LeagueLogo'
import InstallAppButton from './InstallAppButton'
import InviteButton from './InviteButton'
import { PLAYER_SUGGESTIONS } from '../lib/playerSuggestions'
import {
  transformGroupMatches,
  transformKnockoutMatches,
} from '../lib/footballData'
import MatchRow from './dashboard/MatchRow'
import MatchDaySchedule from './dashboard/MatchDaySchedule'
import GroupStandingsView from './dashboard/GroupStandingsView'
import ScheduleViewTabs from './dashboard/ScheduleViewTabs'
import LiveMatchDaySchedule from './dashboard/LiveMatchDaySchedule'
import LiveGroupStandingsView from './dashboard/LiveGroupStandingsView'
import PredictedKnockoutSection from './dashboard/PredictedKnockoutSection'
import { buildInicioKnockoutSchedule } from '../lib/knockoutBridge'
import {
  toMadridDatetimeLocalValue,
  fromMadridDatetimeLocal,
  formatMadridDateTime,
} from '../lib/madridTime'
import {
  Icon, IconLabel, RankDisplay, LockedBanner, SaveButtonLabel, RefreshButtonLabel,
  RoundHeader, TAB_ICONS, PHASE_ICONS, BONUS_FIELD_ICONS,
} from './icons'

export default function GroupDashboard({ group, user, refreshGroup, setCurrentUser, notify, onLeave }) {
  const [tab, setTab] = useState('group')
  const [predPhase, setPredPhase] = useState('group')
  const [scrollToMatchId, setScrollToMatchId] = useState(null)
  const [liveData, setLiveData] = useState([])
  const [apiStatus, setApiStatus] = useState('idle')
  const [apiError, setApiError] = useState(null)
  const [currentGroup, setCurrentGroup] = useState(group)
  const matchRefs = useRef({})

  const { wcMatches, setWcMatches, wcLoading, reload: reloadWc } = useWcMatches()
  const groupMatches = useMemo(() => transformGroupMatches(wcMatches), [wcMatches])
  const knockoutMatches = useMemo(() => transformKnockoutMatches(wcMatches), [wcMatches])
  const isAdmin = user.is_admin

  const {
    groupPreds, setGroupPreds, koPreds, setKoPreds,
    inicioKoPreds, setInicioKoPreds, bonusPreds, setBonusPreds,
    saving, saveStatus, persistPredictions, flushSave,
  } = usePredictions({
    user, group: currentGroup, predPhase, tab, notify, setCurrentUser, isAdmin,
  })

  const orphanGroupKeys = useMemo(() => countOrphanPredKeys(groupPreds, groupMatches), [groupPreds, groupMatches])
  const leaderboard = calcLeaderboard(currentGroup)
  const groupDeadlinePassed = isDeadlinePassed(currentGroup.group_deadline)
  const koDeadlinePassed = isDeadlinePassed(currentGroup.knockout_deadline)
  const teamOptions = useMemo(() => getUniqueTeamsFromMatches(groupMatches, knockoutMatches), [groupMatches, knockoutMatches])
  const adminBadges = isAdmin ? getAdminTaskBadges(currentGroup) : []

  useAutoSyncResults({
    enabled: isAdmin,
    group: currentGroup,
    setGroup: setCurrentGroup,
    wcMatches,
    userId: user.id,
    refreshGroup,
  })

  useEffect(() => {
    if (!isAdmin || tab !== 'admin') return
    reloadWc()
    const t = setInterval(reloadWc, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [isAdmin, tab, reloadWc])

  async function handleRefresh() {
    const updated = await refreshGroup(currentGroup.id)
    if (updated) {
      setCurrentGroup(updated)
      const u = updated.participants?.[user.id]
      if (u) setCurrentUser(u)
    }
  }

  useEffect(() => { const t = setInterval(handleRefresh, 60000); return () => clearInterval(t) }, [currentGroup.id])
  useEffect(() => { setPredPhase(getDefaultPredPhase(currentGroup.phase)) }, [currentGroup.phase])

  useEffect(() => {
    if (!groupMatches.length) return
    const { migrated: g } = migratePredictionMap(user.predictions?.group || {}, groupMatches)
    const { migrated: k } = migratePredictionMap(user.predictions?.knockout || {}, knockoutMatches)
    setGroupPreds(g)
    setKoPreds(k)
  }, [groupMatches.length, knockoutMatches.length])

  useEffect(() => {
    if (tab === 'live' && apiStatus === 'idle' && wcMatches.length > 0) { setLiveData(wcMatches); setApiStatus('ok') }
  }, [tab, wcMatches, apiStatus])

  useEffect(() => {
    if (!scrollToMatchId || tab !== 'predictions') return
    const el = matchRefs.current[scrollToMatchId]
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setScrollToMatchId(null) }
  }, [scrollToMatchId, tab, predPhase])

  function changeTab(next) {
    if (tab === 'predictions' && next !== 'predictions') void flushSave()
    setTab(next)
  }

  function goToPrediction(matchId) {
    setScrollToMatchId(String(matchId))
    if (groupMatches.find(x => String(x.id) === String(matchId))) setPredPhase('group')
    else if (knockoutMatches.find(x => String(x.id) === String(matchId))) setPredPhase('knockout')
    setTab('predictions')
  }

  async function savePredictions() { await persistPredictions(true) }

  async function fetchLive() {
    setApiStatus('loading'); setApiError(null)
    try { const raw = await reloadWc(); setLiveData(raw); setApiStatus('ok') }
    catch (e) { setApiStatus('unavailable'); setApiError(e.message) }
  }

  const navTabs = [
    { id: 'group', label: 'Ranking' },
    { id: 'predictions', label: 'Porra' },
    { id: 'live', label: 'En Vivo', navLabel: 'Vivo' },
    ...(isAdmin ? [{ id: 'admin', label: 'Organización', navLabel: 'Org.' }] : []),
  ]

  function tabNavLabel(t, compact = false) {
    return compact && t.navLabel ? t.navLabel : t.label
  }

  function handleProfileSaved(updatedUser) {
    setCurrentUser(updatedUser)
    setCurrentGroup(g => ({
      ...g,
      participants: {
        ...g.participants,
        [updatedUser.id]: { ...g.participants[updatedUser.id], ...updatedUser },
      },
    }))
  }

  return (
    <div className="dashboard-app">
      <header className="dash-header dash-header--compact" style={{ paddingTop: 'max(8px, var(--safe-top))' }}>
        <div className="dash-header-bar">
          <div className="dash-header-title">
            <LeagueLogo src={currentGroup.league_logo} name={currentGroup.name} size={32} />
            <h1 className="dash-group-name" title={currentGroup.name}>{currentGroup.name}</h1>
          </div>
          <nav className="tab-bar-desktop dash-tabs" aria-label="Secciones">
            {navTabs.map(t => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-selected={tab === t.id}
                className={`dash-tab tab-btn-touch${tab === t.id ? ' dash-tab--active' : ''}`}
                onClick={() => changeTab(t.id)}
              >
                <span className="dash-tab-icon" aria-hidden="true"><Icon name={TAB_ICONS[t.id]} /></span>
                <span className="dash-tab-label" aria-hidden="true">{tabNavLabel(t)}</span>
                {t.id === 'admin' && adminBadges.some(b => b.type === 'warn') && (
                  <span className="dash-tab-dot" aria-hidden="true" />
                )}
              </button>
            ))}
          </nav>
          <div className="dash-header-end">
            <Link
              href="/guia"
              className="header-action-btn header-action-btn--header"
              title="Guía de uso"
              aria-label="Guía de uso"
            >
              <Icon name="academicCap" size="sm" />
              <span className="header-action-btn__text">Guía</span>
            </Link>
            <InviteButton group={currentGroup} userId={user.id} isAdmin={isAdmin} notify={notify} />
            <InstallAppButton variant="header" notify={notify} />
            <button
              type="button"
              className={`dash-profile-btn tab-btn-touch${tab === 'profile' ? ' dash-profile-btn--active' : ''}`}
              title="Mi perfil"
              aria-label="Mi perfil"
              aria-selected={tab === 'profile'}
              onClick={() => changeTab('profile')}
            >
              <ParticipantAvatar participant={user} size={36} />
            </button>
          </div>
        </div>
      </header>
      <main className="dashboard-content dash-content app-container app-container--wide">
        {tab === 'group' && (
          <GroupTab
            leaderboard={leaderboard}
            group={currentGroup}
            groupMatches={groupMatches}
            knockoutMatches={knockoutMatches}
            onLeave={onLeave}
            currentUserId={user.id}
          />
        )}
        {tab === 'predictions' && (
          <PredictionsTab predPhase={predPhase} setPredPhase={setPredPhase} groupPreds={groupPreds} setGroupPreds={setGroupPreds}
            koPreds={koPreds} setKoPreds={setKoPreds}
            inicioKoPreds={inicioKoPreds} setInicioKoPreds={setInicioKoPreds}
            bonusPreds={bonusPreds} setBonusPreds={setBonusPreds}
            saving={saving} saveStatus={saveStatus} onSave={savePredictions}
            groupDeadlinePassed={groupDeadlinePassed} koDeadlinePassed={koDeadlinePassed}
            groupMatches={groupMatches} knockoutMatches={knockoutMatches} teamOptions={teamOptions.length ? teamOptions : ALL_TEAMS}
            wcLoading={wcLoading} groupPhase={currentGroup.phase}
            orphanGroupKeys={orphanGroupKeys} matchRefs={matchRefs}
            deadlines={{ group: currentGroup.group_deadline, knockout: currentGroup.knockout_deadline }} />
        )}
        {tab === 'profile' && (
          <ProfileTab
            user={user}
            groupId={currentGroup.id}
            onSaved={handleProfileSaved}
            notify={notify}
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
            knockoutMatches={knockoutMatches}
            userPreds={user.predictions}
            onGoToPrediction={goToPrediction}
          />
        )}
        {tab === 'admin' && isAdmin && (
          <AdminTab
            group={currentGroup}
            setGroup={setCurrentGroup}
            refreshGroup={refreshGroup}
            notify={notify}
            wcMatches={wcMatches}
            userId={user.id}
          />
        )}
      </main>
      <nav className="bottom-nav dash-main-nav" aria-label="Navegación principal">
        {navTabs.map(t => (
          <button
            key={t.id}
            type="button"
            className={`bottom-nav-btn${tab === t.id ? ' bottom-nav-btn--active' : ''}`}
            title={t.label}
            aria-label={t.label}
            aria-selected={tab === t.id}
            onClick={() => changeTab(t.id)}
          >
            <span className="bottom-nav-icon" aria-hidden="true"><Icon name={TAB_ICONS[t.id]} /></span>
            <span className="bottom-nav-label" aria-hidden="true">{tabNavLabel(t, true)}</span>
            {t.id === 'admin' && adminBadges.some(b => b.type === 'warn') && (
              <span className="bottom-nav-dot" aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ─── GROUP TAB ────────────────────────────────────────────────────────────────
function GroupTab({ leaderboard, group, groupMatches, knockoutMatches, onLeave, currentUserId }) {
  const [view, setView] = useState('ranking')
  const tableRows = useMemo(
    () => enrichLeaderboardWithStats(leaderboard, group),
    [leaderboard, group],
  )
  const hasResults = hasAnyPublishedResults(group)

  return (
    <div className="dash-tab-panel">
      <div className="group-view-toggle" role="tablist" aria-label="Vista de participantes">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'ranking'}
          className={`group-view-btn${view === 'ranking' ? ' group-view-btn--active' : ''}`}
          onClick={() => setView('ranking')}
        >
          Ranking
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'table'}
          className={`group-view-btn${view === 'table' ? ' group-view-btn--active' : ''}`}
          onClick={() => setView('table')}
        >
          Tabla
        </button>
      </div>

      {view === 'table' ? (
        <>
          <SectionTitle>Tabla de puntuación · {leaderboard.length}</SectionTitle>
          <GroupStatsTable rows={tableRows} currentUserId={currentUserId} hasResults={hasResults} />
        </>
      ) : (
        <>
          <SectionTitle>Participantes · {leaderboard.length}</SectionTitle>
          {leaderboard.map((p, i) => (
            <div
              key={p.id}
              className={`dash-player-row${p.id === currentUserId ? ' dash-player-row--you' : ''}${i === 0 ? ' dash-player-row--leader' : ''}`}
            >
              <div className={`dash-rank${i > 2 ? ' dash-rank--num' : ''}`}>
                <RankDisplay index={i} />
              </div>
              <ParticipantAvatar participant={p} size={40} />
              <div className="dash-player-info">
                <ParticipantDisplay
                  participant={p}
                  isYou={p.id === currentUserId}
                  showAdmin
                />
              </div>
              <div className="dash-points">
                {p.total}
                <span className="dash-points-unit"> pts</span>
              </div>
            </div>
          ))}
        </>
      )}

      <button type="button" className="dash-leave-card" onClick={onLeave}>Salir del grupo</button>
    </div>
  )
}

// ─── PREDICTIONS TAB ──────────────────────────────────────────────────────────
function SaveStatusBar({ status }) {
  if (status !== 'error') return null

  return (
    <div className="dash-save-status" style={{ color: 'var(--dash-red)' }} role="alert">
      <Icon name="exclamationTriangle" size="sm" style={{ marginRight: 4 }} />
      No se pudo guardar — pulsa «Guardar ahora» o sigue editando para reintentar
    </div>
  )
}

function PredictionsTab({
  predPhase, setPredPhase, groupPreds, setGroupPreds, koPreds, setKoPreds,
  inicioKoPreds, setInicioKoPreds,
  bonusPreds, setBonusPreds, saving, saveStatus, onSave,
  groupDeadlinePassed, koDeadlinePassed,
  groupMatches, knockoutMatches, teamOptions, wcLoading, groupPhase, deadlines,
  orphanGroupKeys, matchRefs,
}) {
  const [scheduleViewMode, setScheduleViewMode] = useState(readScheduleViewMode)

  function handleScheduleViewMode(mode) {
    setScheduleViewMode(mode)
    writeScheduleViewMode(mode)
  }

  const effectiveViewMode = predPhase === 'knockout' && scheduleViewMode === 'groups'
    ? 'daily'
    : scheduleViewMode

  const phaseLocked = isPhaseLocked(groupPhase, predPhase, false, false)

  const phases = [
    {
      id: 'group',
      label: 'Inicio',
      sub: 'Grupos + previa KO · 60%',
      locked: groupDeadlinePassed,
      countdown: formatCountdown(msUntilDeadline(deadlines.group)),
    },
    {
      id: 'knockout',
      label: 'Eliminatorias',
      sub: 'Calendario real · 40%',
      locked: koDeadlinePassed,
      countdown: formatCountdown(msUntilDeadline(deadlines.knockout)),
    },
    {
      id: 'bonuses',
      label: 'Especiales',
      sub: 'Esp.',
      locked: groupDeadlinePassed,
      countdown: formatCountdown(msUntilDeadline(deadlines.group)),
    },
  ]

  return (
    <div className="dash-tab-panel">
      {orphanGroupKeys > 0 && (
        <div className="dash-banner dash-banner--info">
          {orphanGroupKeys} predicción(es) con formato antiguo — se reindexan al guardar.
        </div>
      )}

      <div className="dash-phase-picker" role="tablist">
        {phases.map(p => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-pressed={predPhase === p.id}
            className="dash-phase-btn"
            onClick={() => setPredPhase(p.id)}
          >
            <span className="dash-phase-icon"><Icon name={PHASE_ICONS[p.id]} /></span>
            <span className="dash-phase-label-row">
              <span className="dash-phase-label">{p.label}</span>
              {!p.locked && p.countdown && p.countdown !== 'Plazo cerrado' && (
                <span className="dash-phase-deadline-tag">{p.countdown}</span>
              )}
            </span>
            <span className="dash-phase-sub" style={{ color: p.locked ? 'var(--dash-red)' : 'var(--dash-accent)' }}>
              {p.locked ? 'Cerrado' : p.sub}
            </span>
          </button>
        ))}
      </div>

      <SaveStatusBar status={saveStatus} />

      {(predPhase === 'group' || predPhase === 'knockout') && (
        <ScheduleViewTabs
          value={effectiveViewMode}
          onChange={handleScheduleViewMode}
          showGroups={predPhase === 'group'}
        />
      )}

      {wcLoading && predPhase === 'group' && (
        <div className="dash-card">
          <div className="dash-empty">Cargando calendario FIFA 2026…</div>
        </div>
      )}
      {predPhase === 'group' && (
        <GroupPhasePreds
          preds={groupPreds}
          setPreds={setGroupPreds}
          inicioKoPreds={inicioKoPreds}
          setInicioKoPreds={setInicioKoPreds}
          locked={groupDeadlinePassed || phaseLocked}
          matches={groupMatches}
          matchRefs={matchRefs}
          viewMode={effectiveViewMode}
        />
      )}
      {predPhase === 'knockout' && (
        <>
          {knockoutMatches.length > 0 && (
            <p className="dash-phase-hint">
              Partidos reales del Mundial (API). Independiente de tu porra de Inicio.
            </p>
          )}
          <KnockoutPreds preds={koPreds} setPreds={setKoPreds} locked={koDeadlinePassed || phaseLocked} matches={knockoutMatches} teamOptions={teamOptions} matchRefs={matchRefs} viewMode={effectiveViewMode} />
        </>
      )}
      {predPhase === 'bonuses' && (
        <BonusPreds preds={bonusPreds} setPreds={setBonusPreds} locked={groupDeadlinePassed || phaseLocked} />
      )}

      <button type="button" className="dash-save-manual" style={s.saveBtn} onClick={onSave}>
        <SaveButtonLabel saving={saving}>Guardar ahora</SaveButtonLabel>
      </button>
    </div>
  )
}

function GroupPhasePreds({
  preds, setPreds, inicioKoPreds, setInicioKoPreds,
  locked, matches = [], matchRefs, viewMode = 'daily',
}) {
  function setScore(id, side, val) {
    if (val === '' || val === undefined) {
      setPreds(p => {
        const next = { ...p[id] }
        delete next[side]
        const row = Object.keys(next).length ? next : undefined
        if (!row) {
          const { [id]: _, ...rest } = p
          return rest
        }
        return { ...p, [id]: next }
      })
      return
    }
    const v = parseInt(val, 10)
    if (Number.isNaN(v) || v < 0 || v > 20) return
    setPreds(p => ({ ...p, [id]: { ...p[id], [side]: v } }))
  }

  const filled = countFilledMatches(preds, matches)
  const total = matches.length || 1

  const inicioKo = useMemo(
    () => buildInicioKnockoutSchedule(matches, preds, inicioKoPreds),
    [matches, preds, inicioKoPreds],
  )

  const dailyAllMatches = useMemo(() => {
    if (viewMode !== 'daily') return matches
    return [...matches, ...inicioKo.schedule]
  }, [viewMode, matches, inicioKo.schedule])

  const combinedPreds = useMemo(
    () => ({ ...preds, ...inicioKoPreds }),
    [preds, inicioKoPreds],
  )

  function handleScore(id, side, val) {
    if (String(id).startsWith('inicio-ko-') || String(id).startsWith('inicio-r32-')) {
      if (val === '' || val === undefined) {
        setInicioKoPreds(p => {
          const next = { ...p[id] }
          delete next[side]
          if (!Object.keys(next).length) {
            const { [id]: _, ...rest } = p
            return rest
          }
          return { ...p, [id]: next }
        })
        return
      }
      const v = parseInt(val, 10)
      if (Number.isNaN(v) || v < 0 || v > 20) return
      setInicioKoPreds(p => ({ ...p, [id]: { ...p[id], [side]: v } }))
      return
    }
    setScore(id, side, val)
  }

  function sectionKey(m) {
    if (m.isPredictedBracket || String(m.id).startsWith('inicio-ko-') || String(m.id).startsWith('inicio-r32-')) {
      return m.roundId || 'r32'
    }
    return m.group || '—'
  }

  function sectionLabel(m) {
    if (m.isPredictedBracket || String(m.id).startsWith('inicio-ko-') || String(m.id).startsWith('inicio-r32-')) {
      return m.roundLabel || 'Dieciseisavos (previstos)'
    }
    return `Grupo ${m.group}`
  }

  if (!matches.length) {
    return (
      <div style={s.apiCard}>
        <div style={s.apiMsg}>No hay partidos de grupos. Comprueba FOOTBALL_DATA_API_KEY en el servidor.</div>
        <div style={s.apiSub}>{PROVISIONAL_TEAMS_NOTE}</div>
      </div>
    )
  }

  return (
    <div>
      {locked && <div className="dash-banner dash-banner--lock">Plazo cerrado · Solo lectura</div>}
      <div className="dash-progress-wrap">
        <div className="dash-progress-bar">
          <div className="dash-progress-fill" style={{ width: `${Math.round(filled / total * 100)}%` }} />
        </div>
        <span className="dash-progress-text">{filled}/{total} partidos</span>
      </div>

      {viewMode === 'groups' ? (
        <GroupStandingsView
          matches={matches}
          preds={preds}
          locked={locked}
          matchRefs={matchRefs}
          onScore={setScore}
        />
      ) : viewMode === 'daily' ? (
        <>
          {inicioKo.error && (
            <PredictedKnockoutSection
              groupMatches={matches}
              groupPreds={preds}
              inicioKoPreds={inicioKoPreds}
              setInicioKoPreds={setInicioKoPreds}
              locked={locked}
              matchRefs={matchRefs}
              viewMode={viewMode}
              hideSchedule
            />
          )}
          <MatchDaySchedule
            matches={dailyAllMatches}
            preds={combinedPreds}
            locked={locked}
            matchRefs={matchRefs}
            onScore={handleScore}
            schedulePhase="group"
            viewMode="daily"
            getSectionKey={sectionKey}
            getSectionLabel={sectionLabel}
          />
        </>
      ) : (
        <>
          <MatchDaySchedule
            matches={matches}
            preds={preds}
            locked={locked}
            matchRefs={matchRefs}
            onScore={setScore}
            schedulePhase="group"
            viewMode={viewMode}
            getSectionKey={m => m.group || '—'}
            getSectionLabel={m => `Grupo ${m.group}`}
          />
          <PredictedKnockoutSection
            groupMatches={matches}
            groupPreds={preds}
            inicioKoPreds={inicioKoPreds}
            setInicioKoPreds={setInicioKoPreds}
            locked={locked}
            matchRefs={matchRefs}
            viewMode={viewMode}
          />
        </>
      )}
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

function KnockoutPreds({ preds, setPreds, locked, matches = [], teamOptions = [], matchRefs, viewMode = 'daily' }) {
  function setVal(id, key, val) {
    const v = key === 'home' || key === 'away' ? parseInt(val, 10) : val
    if ((key === 'home' || key === 'away') && (isNaN(v) || v < 0)) return
    setPreds(p => ({ ...p, [id]: { ...p[id], [key]: v } }))
  }

  function setScore(id, side, val) {
    if (val === '' || val === undefined) {
      setPreds(p => {
        const next = { ...p[id] }
        delete next[side]
        if (!Object.keys(next).length) {
          const { [id]: _, ...rest } = p
          return rest
        }
        return { ...p, [id]: next }
      })
      return
    }
    setVal(id, side, val)
  }

  if (matches.length > 0) {
    return (
      <div>
        {locked && <div className="dash-banner dash-banner--lock">Plazo cerrado · Solo lectura</div>}
        <MatchDaySchedule
          matches={matches}
          preds={preds}
          locked={locked}
          matchRefs={matchRefs}
          onScore={setScore}
          schedulePhase="knockout"
          viewMode={viewMode}
          getSectionKey={m => m.roundId}
          getSectionLabel={m => m.roundLabel}
        />
      </div>
    )
  }

  const opts = teamOptions.length ? teamOptions : ALL_TEAMS

  return (
    <div>
      {locked && <div style={s.lockedBanner}><LockedBanner>Plazo cerrado · Solo lectura</LockedBanner></div>}
      <div style={s.koNote}>
        Calendario no disponible. Elige equipos de la lista y marca resultado.
      </div>
      {KNOCKOUT_ROUNDS.map(round => (
        <div key={round.id} style={s.matchGroup}>
          <div style={s.matchGroupHeader}><RoundHeader roundId={round.id} icon={round.icon} label={round.label} /></div>
          {Array.from({ length: round.matches }).map((_, i) => {
            const id = `${round.id}-${i}`
            return (
              <div key={id} className="ko-card-mobile" style={s.koMatchRow}>
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
    { id: 'topScorer', label: 'Máximo goleador', pts: 5 },
    { id: 'topKeeper', label: 'Portero menos goleado', pts: 5 },
    { id: 'topAssists', label: 'Máximo asistente', pts: 5 },
    { id: 'mvp', label: 'MVP del torneo', pts: 10 },
  ]
  return (
    <div className="dash-bonus-list">
      {locked && <div style={s.lockedBanner}><LockedBanner>Plazo cerrado · Solo lectura</LockedBanner></div>}
      {fields.map(f => (
        <div key={f.id} className="dash-bonus-field">
          <div className="dash-bonus-label">
            <IconLabel icon={BONUS_FIELD_ICONS[f.id]} iconSize="sm">{f.label}</IconLabel>
            <span className="dash-bonus-pts">+{f.pts} pts</span>
          </div>
          <input
            className="dash-bonus-input"
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

// ─── LIVE TAB ─────────────────────────────────────────────────────────────────
function AdminResultsFallback({ group, groupMatches, userPreds }) {
  const withResults = groupMatches.filter(m => {
    const r = group.results?.group?.[m.id]
    return r && r.home != null && r.away != null
  })
  if (!withResults.length) return null
  return (
    <>
      <SectionTitle icon="clipboardList">Resultados del organizador</SectionTitle>
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

function LiveTab({
  liveData, apiStatus, apiError, onFetch, wcLoading,
  group, groupMatches, knockoutMatches, userPreds, onGoToPrediction,
}) {
  const [livePhase, setLivePhase] = useState('group')
  const [scheduleViewMode, setScheduleViewMode] = useState(readScheduleViewMode)

  function handleScheduleViewMode(mode) {
    setScheduleViewMode(mode)
    writeScheduleViewMode(mode)
  }

  const effectiveViewMode =
    livePhase === 'knockout' && scheduleViewMode === 'groups' ? 'daily' : scheduleViewMode

  const phaseMatches = livePhase === 'group' ? groupMatches : knockoutMatches
  const phasePreds = livePhase === 'group' ? (userPreds?.group || {}) : (userPreds?.knockout || {})
  const showFallback = apiStatus === 'unavailable' || (apiStatus === 'idle' && !wcLoading && liveData.length === 0)
  const hasSchedule = liveData.length > 0 && !showFallback

  const livePhases = [
    { id: 'group', label: 'Fase de grupos', icon: PHASE_ICONS.group },
    { id: 'knockout', label: 'Eliminatorias', icon: PHASE_ICONS.knockout },
  ]

  return (
    <div className="dash-tab-panel">
      <div style={s.liveHeader}>
        <SectionTitle icon="signal">Resultados en Vivo</SectionTitle>
        <button
          type="button"
          style={s.fetchBtn}
          onClick={onFetch}
          disabled={apiStatus === 'loading'}
          aria-label="Actualizar resultados"
        >
          <RefreshButtonLabel loading={apiStatus === 'loading'} />
        </button>
      </div>

      {apiStatus === 'idle' && !wcLoading && liveData.length === 0 && (
        <div style={s.apiCard}>
          <div style={s.apiMsg}>Pulsa el botón superior para cargar el calendario FIFA 2026</div>
        </div>
      )}
      {wcLoading && apiStatus !== 'loading' && (
        <div style={s.apiCard}>
          <div style={s.apiMsg}>Cargando 104 partidos del Mundial…</div>
        </div>
      )}
      {apiStatus === 'unavailable' && (
        <div style={{ ...s.apiCard, borderColor: 'var(--yellow-border)' }}>
          <div style={{ color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="exclamationTriangle" size="sm" /> API en vivo no disponible
          </div>
          <div style={s.apiSub}>
            {apiError || 'Configura FOOTBALL_DATA_API_KEY. Mostrando resultados del organizador si existen.'}
          </div>
        </div>
      )}
      {showFallback && (
        <AdminResultsFallback group={group} groupMatches={groupMatches} userPreds={userPreds} />
      )}

      {hasSchedule && (
        <>
          <div className="dash-phase-picker" role="tablist" style={{ marginBottom: 12 }}>
            {livePhases.map(p => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-pressed={livePhase === p.id}
                className="dash-phase-btn"
                onClick={() => setLivePhase(p.id)}
              >
                <span className="dash-phase-icon"><Icon name={p.icon} /></span>
                <span className="dash-phase-label">{p.label}</span>
              </button>
            ))}
          </div>

          <ScheduleViewTabs
            value={effectiveViewMode}
            onChange={handleScheduleViewMode}
            showGroups={livePhase === 'group'}
          />

          {!phaseMatches.length ? (
            <div style={s.apiCard}>
              <div style={s.apiMsg}>No hay partidos en esta fase.</div>
            </div>
          ) : effectiveViewMode === 'groups' ? (
            <LiveGroupStandingsView
              matches={phaseMatches}
              apiMatches={liveData}
              userPreds={phasePreds}
              onGoToPrediction={onGoToPrediction}
            />
          ) : (
            <LiveMatchDaySchedule
              matches={phaseMatches}
              apiMatches={liveData}
              userPreds={phasePreds}
              onGoToPrediction={onGoToPrediction}
              schedulePhase={livePhase === 'group' ? 'group' : 'knockout'}
              viewMode={effectiveViewMode}
              getSectionKey={m => (livePhase === 'group' ? m.group || '—' : m.roundId)}
              getSectionLabel={m => (livePhase === 'group' ? `Grupo ${m.group}` : m.roundLabel)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── ADMIN TAB ────────────────────────────────────────────────────────────────
function AdminTab({ group, setGroup, refreshGroup, notify, wcMatches = [], userId }) {
  async function saveGroupSecure(updates) {
    const token = getStoredWriteToken(group.id, userId)
    if (token) {
      const res = await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id, userId, token, updates }) })
      if (!res.ok) { notify('Error al guardar', 'error'); return false }
      notify('Guardado'); const g = await refreshGroup(group.id); if (g) setGroup(g); return true
    }
    const { error } = await supabase.from('porra_groups').update(updates).eq('id', group.id)
    if (error) notify('Error', 'error'); else { notify('Guardado'); const g = await refreshGroup(group.id); if (g) setGroup(g) }
    return !error
  }

  const [adminTab, setAdminTab] = useState('settings')
  const [leagueLogo, setLeagueLogo] = useState(group.league_logo || '')
  const [groupDeadline, setGroupDeadline] = useState(() => toMadridDatetimeLocalValue(group.group_deadline))
  const [koDeadline, setKoDeadline] = useState(() => toMadridDatetimeLocalValue(group.knockout_deadline))

  useEffect(() => {
    setLeagueLogo(group.league_logo || '')
    setGroupDeadline(toMadridDatetimeLocalValue(group.group_deadline))
    setKoDeadline(toMadridDatetimeLocalValue(group.knockout_deadline))
  }, [group.league_logo, group.group_deadline, group.knockout_deadline])
  const [tournamentPhase, setTournamentPhase] = useState(group.phase || 'group')
  const [actuals, setActuals] = useState(group.actuals || {})
  const [saving, setSaving] = useState(false)

  const apiFinished = countFinishedFromApi(wcMatches)
  const storedGroup = Object.keys(group.results?.group || {}).length
  const storedKo = Object.keys(group.results?.knockout || {}).length

  async function saveDeadlines() {
    setSaving(true)
    const groupDeadlineValue = fromMadridDatetimeLocal(groupDeadline)
    await saveGroupSecure({
      group_deadline: groupDeadlineValue,
      knockout_deadline: fromMadridDatetimeLocal(koDeadline),
      bonus_deadline: groupDeadlineValue,
      phase: tournamentPhase,
    })
    setSaving(false)
  }

  async function saveActuals() {
    setSaving(true)
    await saveGroupSecure({ actuals })
    setSaving(false)
  }

  async function handleLeagueLogoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await resizeLogoFile(file, { maxPx: 160 })
      setLeagueLogo(dataUrl)
    } catch (err) {
      notify(err.message || 'Error al procesar la imagen', 'error')
    }
  }

  async function saveLeagueLogo() {
    setSaving(true)
    await saveGroupSecure({ league_logo: leagueLogo || null })
    setSaving(false)
  }

  const adminAlerts = getAdminTaskBadges(group)

  return (
    <div className="dash-tab-panel admin-panel">
      <SectionTitle icon="cog6Tooth">Organización</SectionTitle>

      {adminAlerts.length > 0 && (
        <div className="dash-admin-alerts">
          {adminAlerts.map((b, i) => (
            <p key={i} className={`dash-admin-alert${b.type === 'warn' ? ' dash-admin-alert--warn' : ''}`}>{b.text}</p>
          ))}
        </div>
      )}

      <div style={s.adminTabs}>
        {[
          { id: 'settings', icon: 'cog6Tooth', label: 'Configuración' },
          { id: 'deadlines', icon: 'clock', label: 'Plazos' },
          { id: 'actuals', icon: 'trophy', label: 'Ganadores' },
        ].map(t => (
          <button key={t.id} type="button"
            style={{ ...s.adminTab, ...(adminTab === t.id ? s.adminTabActive : {}) }}
            onClick={() => setAdminTab(t.id)}>
            <IconLabel icon={t.icon} iconSize="sm">{t.label}</IconLabel>
          </button>
        ))}
      </div>

      <div className="dash-card admin-api-status">
        <IconLabel icon="arrowPath" iconSize="sm">Resultados de partidos</IconLabel>
        <p style={{ fontSize: 13, color: 'var(--dash-muted)', margin: '8px 0 0' }}>
          Los marcadores de grupos y eliminatorias se sincronizan solos desde la API cuando los partidos finalizan.
          Guardados: {storedGroup} grupos · {storedKo} eliminatorias
          {apiFinished.group + apiFinished.knockout > 0 && (
            <> · API: {apiFinished.group + apiFinished.knockout} finalizados detectados</>
          )}
        </p>
      </div>

      {adminTab === 'settings' && (
        <div className="dash-card profile-form">
          <div className="dash-card-title">Logo de la liga</div>
          <p className="profile-field-hint" style={{ marginTop: 0 }}>
            Aparece junto al nombre del grupo en la cabecera para todos los participantes.
          </p>
          <div className="profile-preview" style={{ marginTop: 12 }}>
            {leagueLogo ? (
              <LeagueLogo src={leagueLogo} name={group.name} size={72} className="dash-league-logo--preview" />
            ) : (
              <div className="dash-league-logo-placeholder" aria-hidden="true">
                {group.name[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="profile-preview-text">
              <strong>{group.name}</strong>
              <span>Código #{group.id}</span>
            </div>
          </div>
          <div className="profile-field">
            <div className="profile-logo-actions">
              <label className="profile-upload-btn">
                <input type="file" accept="image/*" onChange={handleLeagueLogoChange} hidden />
                {leagueLogo ? 'Cambiar logo' : 'Subir logo'}
              </label>
              {leagueLogo && (
                <button type="button" className="profile-remove-logo" onClick={() => setLeagueLogo('')}>
                  Quitar logo
                </button>
              )}
            </div>
            <p className="profile-field-hint">JPG o PNG, máx. 2 MB.</p>
          </div>
          <button type="button" className="profile-save-btn" onClick={saveLeagueLogo} disabled={saving}>
            <SaveButtonLabel saving={saving}>Guardar configuración</SaveButtonLabel>
          </button>
        </div>
      )}

      {adminTab === 'deadlines' && (
        <div className="dash-admin-deadlines">
          <p className="dash-admin-note">
            Fechas tope en hora de Madrid (España). Pasado el plazo, la porra se bloquea sola.
          </p>
          <div>
            <label className="dash-field-label"><IconLabel icon="clock" iconSize="sm">Inicio (grupos + especiales)</IconLabel></label>
            <input type="datetime-local" className="dash-field-input" value={groupDeadline} onChange={e => setGroupDeadline(e.target.value)} />
          </div>
          <div>
            <label className="dash-field-label" htmlFor="admin-ko-deadline"><IconLabel icon="clock" iconSize="sm">Eliminatorias</IconLabel></label>
            <input id="admin-ko-deadline" type="datetime-local" className="dash-field-input" value={koDeadline} onChange={e => setKoDeadline(e.target.value)} />
          </div>
          <div>
            <label className="dash-field-label" htmlFor="admin-phase">Fase visible en la porra</label>
            <select id="admin-phase" className="dash-field-input" value={tournamentPhase} onChange={e => setTournamentPhase(e.target.value)}>
              <option value="group">Fase de grupos</option>
              <option value="knockout">Eliminatorias</option>
              <option value="finished">Finalizado</option>
            </select>
          </div>
          <button type="button" style={s.saveBtn} onClick={saveDeadlines} disabled={saving}>
            <SaveButtonLabel saving={saving}>Guardar plazos</SaveButtonLabel>
          </button>
        </div>
      )}

      {adminTab === 'actuals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={s.adminNote}>
            Solo esto debes rellenar a mano: los premios especiales (goleador, MVP, etc.).
          </p>
          {[
            { id: 'topScorer', label: 'Máximo goleador' },
            { id: 'topKeeper', label: 'Portero menos goleado' },
            { id: 'topAssists', label: 'Máximo asistente' },
            { id: 'mvp', label: 'MVP del torneo' },
          ].map(f => (
            <div key={f.id}>
              <label style={s.label}><IconLabel icon={BONUS_FIELD_ICONS[f.id]} iconSize="sm">{f.label}</IconLabel></label>
              <input style={s.input} placeholder="Nombre del jugador"
                value={actuals[f.id] || ''}
                onChange={e => setActuals(a => ({ ...a, [f.id]: e.target.value }))} />
            </div>
          ))}
          <button type="button" style={s.saveBtn} onClick={saveActuals} disabled={saving}>
            <SaveButtonLabel saving={saving}>Guardar ganadores</SaveButtonLabel>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function SectionTitle({ icon, children }) {
  return (
    <div style={{ ...s.sectionTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon && <Icon name={icon} size="md" />}
      {children}
    </div>
  )
}

function EmptyState({ text }) {
  return <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 32, fontSize: 14 }}>{text}</div>
}

function DeadlineBadge({ label, deadline, passed }) {
  return (
    <div style={{
      ...s.deadlineBadge,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      borderColor: passed ? 'var(--red-border)' : 'var(--accent-glow)',
      color: passed ? 'var(--red)' : 'var(--accent-dark)'
    }}>
      <Icon name={passed ? 'lockClosed' : 'clock'} size={14} />
      {label}: {formatMadridDateTime(deadline)}
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 },
  header: {
    background: 'var(--white)',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50,
    boxShadow: 'var(--card-shadow)',
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
    background: 'var(--white)', borderColor: 'var(--accent)', color: 'var(--accent-dark)',
    boxShadow: 'var(--card-shadow)',
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
  pointsRowMiss: { opacity: 0.85, borderLeft: '3px solid var(--red)', paddingLeft: 8 },
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
    background: 'var(--white)', border: 'none', borderBottom: '2px solid transparent',
    color: 'var(--muted)', padding: '8px 14px', cursor: 'pointer',
    fontSize: 18, flexShrink: 0, transition: 'all 0.2s'
  },
  tabActive: {
    color: 'var(--accent-dark)', borderBottomColor: 'var(--accent)', background: 'var(--white)',
  },
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
  liveTeams: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  liveTeamSide: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 0,
    textAlign: 'center',
  },
  liveTeam: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.25,
    textAlign: 'center',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
    width: '100%',
  },
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
    background: 'var(--white)', border: '1px solid var(--accent)',
    color: 'var(--accent-dark)', boxShadow: 'var(--card-shadow)',
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
