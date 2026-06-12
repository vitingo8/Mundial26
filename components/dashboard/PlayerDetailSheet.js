'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import TeamCrest from '../TeamCrest'
import { buildPlayerDetailView } from '../../lib/playerMatchStats'
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

function PlayerHeatmap({ svg, touches }) {
  return (
    <section className="player-detail-section">
      <div className="player-detail-section-head">
        <h3 className="player-detail-section-title">Mapa de calor</h3>
        {touches != null && (
          <span className="player-detail-section-meta">Toques {touches}</span>
        )}
      </div>
      {svg ? (
        <div className="player-detail-heatmap">
          <svg
            className="player-detail-heatmap-svg"
            viewBox="0 0 105 68"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="player-heat-gradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#fb923c" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.75" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="105" height="68" fill="#dcfce7" rx="2" />
            <rect x="0" y="0" width="52.5" height="68" fill="rgba(255,255,255,0.18)" />
            <circle cx="52.5" cy="34" r="9" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="0.8" />
            <rect x="0" y="17" width="16" height="34" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="0.8" />
            <rect x="89" y="17" width="16" height="34" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="0.8" />
            <g className="player-detail-heatmap-dots" dangerouslySetInnerHTML={{ __html: svg }} />
          </svg>
        </div>
      ) : (
        <p className="player-detail-hint player-detail-hint--inline">
          Mapa de calor no disponible para este jugador.
        </p>
      )}
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
  const [heatmapSvg, setHeatmapSvg] = useState(null)
  const [heatmapLoading, setHeatmapLoading] = useState(true)
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
  }, [playerId])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = 0
  }, [activeTab, playerId])

  useEffect(() => {
    if (!playerId || !matchId) return
    let cancelled = false
    setHeatmapLoading(true)
    setHeatmapSvg(null)
    const params = {
      matchId: String(matchId),
      playerId: String(playerId),
    }
    if (match?.heatmapPubUrl) params.heatmapPubUrl = match.heatmapPubUrl
    fetchWcResource('player-heatmap', params)
      .then(data => {
        if (!cancelled) setHeatmapSvg(typeof data?.svg === 'string' ? data.svg : null)
      })
      .catch(() => {
        if (!cancelled) setHeatmapSvg(null)
      })
      .finally(() => {
        if (!cancelled) setHeatmapLoading(false)
      })
    return () => { cancelled = true }
  }, [matchId, playerId, match?.heatmapPubUrl])

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
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="player-detail-body" ref={bodyRef}>
          <div className="player-detail-tab-panel">
            {activeTab === 'destacados' && (
              <>
                {heatmapLoading ? (
                  <p className="player-detail-hint">Cargando mapa de calor…</p>
                ) : (
                  <PlayerHeatmap svg={heatmapSvg} touches={player.touches} />
                )}
                <PlayerHighlights items={player.highlights} />
              </>
            )}

            {activeTab === 'estadisticas' && (
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
