'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import TeamCrest from '../TeamCrest'
import {
  buildPlayerDetailView,
  buildPlayerHeatmapSvg,
  formatShotMinute,
  formatShotSituation,
  formatShotTooltip,
  formatShotType,
  formatShotXg,
  getShotMapColor,
  getShotMapFill,
  getShotMapLineColor,
  miniGoalShotToSvg,
  shouldShowShotGoalDot,
  shotGoalFaceToSvg,
  shotTrajectoryEndSvg,
  SHOT_MAP_GOAL,
  SHOT_MAP_GOAL_AREA,
  SHOT_MAP_PENALTY_ARC,
  SHOT_MAP_PENALTY_BOX,
  SHOT_MAP_VIEW_HEIGHT,
  SHOT_MAP_VIEW_WIDTH,
  shotPitchToSvg,
} from '../../lib/playerMatchStats'
import { fetchWcResource } from '../../lib/footballData'

const PLAYER_TABS = [
  { id: 'destacados', label: 'Destacados' },
  { id: 'estadisticas', label: 'Estadísticas' },
]

function ratingTone(rating) {
  if (rating == null) return 'neutral'
  if (rating >= 7) return 'high'
  if (rating >= 6) return 'mid'
  return 'low'
}

function HeatmapPitch() {
  return (
    <svg className="player-detail-heatmap-pitch" viewBox="0 0 105 68" aria-hidden="true">
      <rect width="105" height="68" fill="#fff" />
      <rect x="0.5" y="0.5" width="104" height="67" fill="none" stroke="#e5e7eb" strokeWidth="0.7" />
      <line x1="52.5" y1="0" x2="52.5" y2="68" stroke="#e5e7eb" strokeWidth="0.7" />
      <circle cx="52.5" cy="34" r="9" fill="none" stroke="#e5e7eb" strokeWidth="0.7" />
      <rect x="0.5" y="17" width="16" height="34" fill="none" stroke="#e5e7eb" strokeWidth="0.7" />
      <rect x="88.5" y="17" width="16" height="34" fill="none" stroke="#e5e7eb" strokeWidth="0.7" />
    </svg>
  )
}

function PlayerHeatmap({ circles, template, touches }) {
  const reactId = useId().replace(/:/g, '')
  const markup = useMemo(
    () => buildPlayerHeatmapSvg(template, circles, `player-heat-${reactId}`),
    [template, circles, reactId],
  )

  return (
    <section className="player-detail-section">
      <div className="player-detail-section-head">
        <h3 className="player-detail-section-title">Mapa de calor</h3>
        {touches != null && (
          <span className="player-detail-section-meta">Toques {touches}</span>
        )}
      </div>
      {markup ? (
        <div className="player-detail-heatmap">
          <HeatmapPitch />
          <div
            className="player-detail-heatmap-cloud"
            dangerouslySetInnerHTML={{ __html: markup }}
          />
        </div>
      ) : (
        <p className="player-detail-hint player-detail-hint--inline">
          Mapa de calor no disponible para este jugador.
        </p>
      )}
    </section>
  )
}

function ShotPitchSvg({ shots, selectedId, onSelect }) {
  const viewW = SHOT_MAP_VIEW_WIDTH
  const viewH = SHOT_MAP_VIEW_HEIGHT

  return (
    <svg
      className="player-detail-shotmap-svg"
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect width={viewW} height={viewH} fill="#fff" />
      <line x1="0" y1={viewH} x2={viewW} y2={viewH} stroke="#eef0f2" strokeWidth="0.45" />
      <rect
        x={SHOT_MAP_PENALTY_BOX.x}
        y="0"
        width={SHOT_MAP_PENALTY_BOX.width}
        height={SHOT_MAP_PENALTY_BOX.height}
        fill="none"
        stroke="#eef0f2"
        strokeWidth="0.45"
      />
      <rect
        x={SHOT_MAP_GOAL_AREA.x}
        y="0"
        width={SHOT_MAP_GOAL_AREA.width}
        height={SHOT_MAP_GOAL_AREA.height}
        fill="none"
        stroke="#eef0f2"
        strokeWidth="0.45"
      />
      <path
        d={`M ${SHOT_MAP_PENALTY_ARC.x1} ${SHOT_MAP_PENALTY_ARC.y} A 9 9 0 0 0 ${SHOT_MAP_PENALTY_ARC.x2} ${SHOT_MAP_PENALTY_ARC.y}`}
        fill="none"
        stroke="#eef0f2"
        strokeWidth="0.45"
      />
      <rect
        x={SHOT_MAP_GOAL.x}
        y="0"
        width={SHOT_MAP_GOAL.width}
        height={SHOT_MAP_GOAL.height}
        fill="#374151"
      />

      {shots.map(shot => {
        const hasSelection = selectedId != null
        const selected = hasSelection && String(shot.id) === String(selectedId)
        const start = shotPitchToSvg(shot.x, shot.y)
        const color = getShotMapColor(shot, selected)
        const fill = getShotMapFill(shot)
        const goalDot = shouldShowShotGoalDot(shot) ? shotGoalFaceToSvg(shot) : null
        const title = formatShotTooltip(shot)

        return (
          <g
            key={shot.id}
            className={`player-detail-shot${selected ? ' player-detail-shot--selected' : ''}`}
            onClick={() => onSelect?.(selected ? null : shot.id)}
            style={{ cursor: onSelect ? 'pointer' : undefined }}
          >
            <circle
              cx={start.sx}
              cy={start.sy}
              r={selected ? 1.45 : 1.15}
              fill={selected ? '#fff' : fill}
              stroke={color}
              strokeWidth={selected ? 0.3 : 0.2}
            />
            {goalDot && (
              <circle
                cx={goalDot.sx}
                cy={goalDot.sy}
                r={selected ? 0.7 : 0.55}
                fill={color}
                stroke="#fff"
                strokeWidth="0.15"
              />
            )}
            <title>{title}</title>
          </g>
        )
      })}

      <g className="player-detail-shot-lines" pointerEvents="none">
        {shots.map(shot => {
          const hasSelection = selectedId != null
          const selected = hasSelection && String(shot.id) === String(selectedId)
          const showLine = !hasSelection || selected
          if (!showLine) return null

          const start = shotPitchToSvg(shot.x, shot.y)
          const end = shotTrajectoryEndSvg(shot)
          const color = getShotMapLineColor(shot, selected)
          const lineLen = Math.hypot(end.sx - start.sx, end.sy - start.sy)
          if (lineLen < 0.35) return null

          return (
            <line
              key={`line-${shot.id}`}
              x1={start.sx}
              y1={start.sy}
              x2={end.sx}
              y2={end.sy}
              stroke={color}
              strokeWidth={selected ? 0.35 : 0.25}
              strokeOpacity={selected ? 0.7 : 0.55}
            />
          )
        })}
      </g>
    </svg>
  )
}

function ShotMiniGoal({ shot }) {
  const dot = shot?.onGoal ? miniGoalShotToSvg(shot.onGoal) : null
  const color = getShotMapColor(shot, true)

  return (
    <div className="player-detail-shot-mini-goal">
      <svg viewBox="0 0 68 24" aria-hidden="true">
        <rect x="22" y="2" width="24" height="14" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
        <line x1="22" y1="16" x2="46" y2="16" stroke="#374151" strokeWidth="0.8" />
        {dot && (
          <circle cx={dot.sx} cy={dot.sy} r="1.4" fill={color} />
        )}
      </svg>
      <div className="player-detail-shot-xg-row">
        <div>
          <span className="player-detail-shot-xg-value">{formatShotXg(shot?.xG)}</span>
          <span className="player-detail-shot-xg-label">xG</span>
        </div>
        <div>
          <span className="player-detail-shot-xg-value">
            {shot?.xGOT != null && shot.xGOT > 0 ? formatShotXg(shot.xGOT) : '—'}
          </span>
          <span className="player-detail-shot-xg-label">xGOT</span>
        </div>
      </div>
    </div>
  )
}

function PlayerShotmap({ shots }) {
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!shots?.length) {
      setSelectedId(null)
      return
    }
    if (selectedId != null && !shots.some(s => String(s.id) === String(selectedId))) {
      setSelectedId(null)
    }
  }, [shots, selectedId])

  if (!shots?.length) return null

  const selected = selectedId != null
    ? shots.find(s => String(s.id) === String(selectedId))
    : null

  return (
    <section className="player-detail-section player-detail-section--shots">
      <div className="player-detail-section-head">
        <h3 className="player-detail-section-title">Tiros</h3>
        <span className="player-detail-section-meta">{shots.length}</span>
      </div>

      <div className="player-detail-shotmap">
        <div className="player-detail-shotmap-canvas">
          <ShotPitchSvg
            shots={shots}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <div className="player-detail-shot-pills" role="tablist" aria-label="Minutos de tiro">
          {shots.map(shot => {
            const active = selectedId != null && String(shot.id) === String(selectedId)
            return (
              <button
                key={shot.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`player-detail-shot-pill${active ? ' player-detail-shot-pill--active' : ''}${shot.isGoal ? ' player-detail-shot-pill--goal' : ''}`}
                onClick={() => setSelectedId(active ? null : shot.id)}
              >
                {formatShotMinute(shot.minute, shot.minAdded)}
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="player-detail-shot-detail">
            <dl className="player-detail-shot-facts">
              <div>
                <dt>Tipo de tiro</dt>
                <dd>{formatShotType(selected.shotType)}</dd>
              </div>
              <div>
                <dt>Situación</dt>
                <dd>{formatShotSituation(selected.situation)}</dd>
              </div>
              <div>
                <dt>Resultado</dt>
                <dd>{selected.eventLabel}</dd>
              </div>
            </dl>
            <ShotMiniGoal shot={selected} />
          </div>
        )}
      </div>
    </section>
  )
}

function PlayerHighlights({ items }) {
  if (!items.length) return null
  return (
    <section className="player-detail-highlights">
      <span className="player-detail-highlights-badge">Destacados</span>
      <ul className="player-detail-highlights-list">
        {items.map((text, i) => (
          <li key={`${i}-${text}`}>{text}</li>
        ))}
      </ul>
    </section>
  )
}

function PlayerStatSections({ sections }) {
  if (!sections.length) {
    return (
      <p className="player-detail-hint">
        Estadísticas del partido no disponibles todavía para este jugador.
      </p>
    )
  }

  return sections.map(section => (
    <section key={section.title} className="player-detail-section">
      <h3 className="player-detail-section-title">{section.title}</h3>
      <dl className="player-detail-stats">
        {section.rows.map(row => (
          <div key={`${section.title}-${row.label}`} className="player-detail-stat-row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  ))
}

export default function PlayerDetailSheet({
  match,
  matchId,
  playerId,
  roster = [],
  onClose,
  onChangePlayer,
}) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('destacados')
  const [loadedTabs, setLoadedTabs] = useState(() => new Set())
  const [heatmapCircles, setHeatmapCircles] = useState(null)
  const [heatmapTemplate, setHeatmapTemplate] = useState(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const bodyRef = useRef(null)

  const lineupPlayer = useMemo(
    () => roster.find(p => String(p.id) === String(playerId)) || null,
    [roster, playerId],
  )
  const player = useMemo(
    () => buildPlayerDetailView(match, playerId, lineupPlayer),
    [match, playerId, lineupPlayer],
  )

  const rosterIndex = useMemo(
    () => roster.findIndex(p => String(p.id) === String(playerId)),
    [roster, playerId],
  )
  const hasPrev = rosterIndex > 0
  const hasNext = rosterIndex >= 0 && rosterIndex < roster.length - 1

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setActiveTab('destacados')
    setLoadedTabs(new Set())
    setHeatmapCircles(null)
    setHeatmapTemplate(null)
    setHeatmapLoading(false)
  }, [playerId])

  function activateTab(tabId) {
    setActiveTab(tabId)
    setLoadedTabs(prev => {
      if (prev.has(tabId)) return prev
      const next = new Set(prev)
      next.add(tabId)
      return next
    })
  }

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = 0
  }, [activeTab, playerId])

  const loadDestacados = loadedTabs.has('destacados')

  useEffect(() => {
    if (!playerId || !matchId || !loadDestacados) return
    let cancelled = false
    setHeatmapLoading(true)
    setHeatmapCircles(null)
    setHeatmapTemplate(null)
    const params = {
      matchId: String(matchId),
      playerId: String(playerId),
    }
    if (match?.heatmapPubUrl) params.heatmapPubUrl = match.heatmapPubUrl
    if (player?.optaId != null) params.optaId = String(player.optaId)
    fetchWcResource('player-heatmap', params)
      .then(data => {
        if (!cancelled) {
          setHeatmapCircles(typeof data?.svg === 'string' ? data.svg : null)
          setHeatmapTemplate(typeof data?.template === 'string' ? data.template : null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHeatmapCircles(null)
          setHeatmapTemplate(null)
        }
      })
      .finally(() => {
        if (!cancelled) setHeatmapLoading(false)
      })
    return () => { cancelled = true }
  }, [matchId, playerId, match?.heatmapPubUrl, player?.optaId, loadDestacados])

  useEffect(() => {
    if (!playerId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onChangePlayer?.(roster[rosterIndex - 1].id)
      if (e.key === 'ArrowRight' && hasNext) onChangePlayer?.(roster[rosterIndex + 1].id)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [playerId, onClose, onChangePlayer, hasPrev, hasNext, roster, rosterIndex])

  if (!player || !mounted) return null

  const tone = ratingTone(player.rating)

  return createPortal(
    <div
      className="player-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="player-detail-sheet">
        <header className="player-detail-header">
          <div className="player-detail-nav">
            <button
              type="button"
              className="player-detail-nav-btn"
              aria-label="Jugador anterior"
              disabled={!hasPrev}
              onClick={() => hasPrev && onChangePlayer?.(roster[rosterIndex - 1].id)}
            >
              <Icon name="chevronLeft" size="sm" />
            </button>
            <button
              type="button"
              className="player-detail-nav-btn"
              aria-label="Jugador siguiente"
              disabled={!hasNext}
              onClick={() => hasNext && onChangePlayer?.(roster[rosterIndex + 1].id)}
            >
              <Icon name="chevronRight" size="sm" />
            </button>
          </div>

          <div className="player-detail-hero">
            <div className="player-detail-photo-wrap">
              {player.photoUrl ? (
                <img className="player-detail-photo" src={player.photoUrl} alt="" loading="lazy" />
              ) : (
                <span className="player-detail-photo-fallback">{player.shirtNumber ?? '?'}</span>
              )}
              {player.rating != null && (
                <span className={`player-detail-rating player-detail-rating--${tone}`}>
                  {Number(player.rating).toFixed(1)}
                </span>
              )}
              {player.countryFlagUrl && (
                <img className="player-detail-flag" src={player.countryFlagUrl} alt="" loading="lazy" />
              )}
            </div>
            <h2 id="player-detail-title" className="player-detail-name">{player.name}</h2>
            <dl className="player-detail-meta">
              <div>
                <dt>Posición</dt>
                <dd>{player.positionShort}</dd>
              </div>
              <div>
                <dt>Equipo</dt>
                <dd className="player-detail-meta-team">
                  {player.clubCrest && <TeamCrest src={player.clubCrest} alt="" size={16} />}
                  <span>{player.club || player.teamName || '—'}</span>
                </dd>
              </div>
              <div>
                <dt>Edad</dt>
                <dd>{player.age ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="player-detail-tabs" role="tablist" aria-label="Secciones del jugador">
            {PLAYER_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`player-detail-tab${activeTab === tab.id ? ' player-detail-tab--active' : ''}`}
                onClick={() => activateTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="player-detail-body" ref={bodyRef}>
          <div className="player-detail-tab-panel">
            {!loadedTabs.has(activeTab) && (
              <p className="player-detail-hint">
                Pulsa la pestaña para cargar el contenido.
              </p>
            )}

            {loadedTabs.has('destacados') && activeTab === 'destacados' && (
              <>
                {heatmapLoading ? (
                  <p className="player-detail-hint">Cargando mapa de calor…</p>
                ) : (
                  <PlayerHeatmap
                    circles={heatmapCircles}
                    template={heatmapTemplate}
                    touches={player.touches}
                  />
                )}
                <PlayerShotmap shots={player.shots} />
                <PlayerHighlights items={player.highlights} />
              </>
            )}

            {loadedTabs.has('estadisticas') && activeTab === 'estadisticas' && (
              <PlayerStatSections sections={player.statSections} />
            )}
          </div>
        </div>

        <footer className="player-detail-footer">
          <button type="button" className="player-detail-done" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
