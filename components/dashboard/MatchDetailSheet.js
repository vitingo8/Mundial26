'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import TeamCrest from '../TeamCrest'
import { Icon, MatchStatus } from '../icons'
import { fetchWcMatchClient, formatMatchDateTime, formatStageLabel } from '../../lib/footballData'
import {
  buildMatchTimeline,
  formatEventMinute,
  getMatchDetailScore,
  goalTypeLabel,
  isLiveMatchStatus,
  pickTeamStatistics,
} from '../../lib/matchDetail'

const LIVE_POLL_MS = 45_000

export default function MatchDetailSheet({ matchId, summary, userPred, onClose }) {
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!matchId) return
    setError(null)
    try {
      const data = await fetchWcMatchClient(matchId)
      setMatch(data)
    } catch (e) {
      setError(e.message || 'No se pudo cargar el partido')
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    setMatch(null)
    setLoading(true)
    setError(null)
    load()
  }, [load])

  useEffect(() => {
    if (!matchId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [matchId, onClose])

  useEffect(() => {
    if (!match || !isLiveMatchStatus(match.status)) return
    const t = setInterval(load, LIVE_POLL_MS)
    return () => clearInterval(t)
  }, [match?.status, load])

  const home = match?.homeTeam || {}
  const away = match?.awayTeam || {}
  const homeName = home.shortName || home.name || summary?.home || 'Local'
  const awayName = away.shortName || away.name || summary?.away || 'Visitante'
  const homeCrest = home.crest || summary?.homeCrest
  const awayCrest = away.crest || summary?.awayCrest
  const score = useMemo(() => (match ? getMatchDetailScore(match) : null), [match])
  const timeline = useMemo(() => buildMatchTimeline(match), [match])
  const homeStats = pickTeamStatistics(home.statistics)
  const awayStats = pickTeamStatistics(away.statistics)
  const hasLineups = (home.lineup?.length || 0) + (away.lineup?.length || 0) > 0
  const titleId = 'match-detail-title'

  if (!matchId) return null

  return (
    <div
      className="match-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="match-detail-sheet">
        <header className="match-detail-header">
          <div className="match-detail-header-top">
            <div className="match-detail-meta">
              {match?.stage && (
                <span className="match-detail-stage">{formatStageLabel(match.stage)}</span>
              )}
              {match?.group && (
                <span className="match-detail-stage">
                  {String(match.group).replace('GROUP_', 'Grupo ')}
                </span>
              )}
              {match?.venue && <span className="match-detail-venue">{match.venue}</span>}
            </div>
            <button
              type="button"
              className="match-detail-close"
              aria-label="Cerrar"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <h2 id={titleId} className="match-detail-scoreboard">
            <span className="match-detail-team">
              <TeamCrest src={homeCrest} alt={homeName} size={36} />
              <span className="match-detail-team-name">{homeName}</span>
            </span>
            <span className="match-detail-score-col">
              {score ? (
                <span className="match-detail-score">
                  {score.home} - {score.away}
                </span>
              ) : (
                <span className="match-detail-score match-detail-score--vs">vs</span>
              )}
              {match?.status && (
                <MatchStatus status={match.status} highlight={isLiveMatchStatus(match.status)} />
              )}
              {match?.minute != null && isLiveMatchStatus(match.status) && (
                <span className="match-detail-minute">{match.minute}&apos;</span>
              )}
              {score?.label && <span className="match-detail-score-hint">{score.label}</span>}
            </span>
            <span className="match-detail-team match-detail-team--away">
              <span className="match-detail-team-name">{awayName}</span>
              <TeamCrest src={awayCrest} alt={awayName} size={36} />
            </span>
          </h2>

          {(match?.utcDate || summary?.utcDate) && (
            <p className="match-detail-datetime">
              {formatMatchDateTime(match?.utcDate || summary.utcDate)}
            </p>
          )}

          {userPred && (
            <p className="match-detail-pred">
              Tu porra: {userPred.home ?? '?'}-{userPred.away ?? '?'}
            </p>
          )}

          <button
            type="button"
            className="match-detail-refresh"
            onClick={() => { setLoading(true); load() }}
            disabled={loading}
          >
            <Icon name="arrowPath" size="sm" />
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </header>

        <div className="match-detail-body">
          {loading && !match && (
            <p className="match-detail-empty">Cargando datos del partido…</p>
          )}
          {error && (
            <p className="match-detail-error" role="alert">{error}</p>
          )}

          {!loading && match && (
            <>
              {timeline.length > 0 && (
                <section className="match-detail-section">
                  <h3 className="match-detail-section-title">Cronología</h3>
                  <ul className="match-detail-timeline">
                    {timeline.map((ev, i) => (
                      <li key={`${ev.kind}-${ev.minute}-${i}`} className={`match-detail-event match-detail-event--${ev.kind}`}>
                        <span className="match-detail-event-min">{formatEventMinute(ev.minute, ev.injuryTime)}</span>
                        <span className="match-detail-event-body">
                          {ev.kind === 'goal' && (
                            <>
                              <strong>{ev.playerName || 'Gol'}</strong>
                              {ev.type && ev.type !== 'REGULAR' && (
                                <span className="match-detail-event-tag"> ({goalTypeLabel(ev.type)})</span>
                              )}
                              {ev.assistName && (
                                <span className="match-detail-event-sub"> · Asist: {ev.assistName}</span>
                              )}
                              {ev.score && (
                                <span className="match-detail-event-sub"> · {ev.score.home}-{ev.score.away}</span>
                              )}
                            </>
                          )}
                          {ev.kind === 'card' && (
                            <>
                              <span className={`match-detail-card match-detail-card--${(ev.card || '').toLowerCase()}`} />
                              <strong>{ev.playerName}</strong>
                              <span className="match-detail-event-sub"> · {ev.teamName}</span>
                            </>
                          )}
                          {ev.kind === 'sub' && (
                            <>
                              <span className="match-detail-event-sub">Sale {ev.playerOut}</span>
                              <span className="match-detail-event-sub"> · Entra {ev.playerIn}</span>
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {hasLineups ? (
                <section className="match-detail-section">
                  <h3 className="match-detail-section-title">Alineaciones</h3>
                  <div className="match-detail-lineups">
                    <LineupColumn
                      teamName={homeName}
                      crest={homeCrest}
                      formation={home.formation}
                      lineup={home.lineup}
                      bench={home.bench}
                    />
                    <LineupColumn
                      teamName={awayName}
                      crest={awayCrest}
                      formation={away.formation}
                      lineup={away.lineup}
                      bench={away.bench}
                    />
                  </div>
                </section>
              ) : (
                <p className="match-detail-hint">
                  Alineación y eventos detallados pueden requerir un plan Deep Data en football-data.org.
                </p>
              )}

              {(homeStats.length > 0 || awayStats.length > 0) && (
                <section className="match-detail-section">
                  <h3 className="match-detail-section-title">Estadísticas</h3>
                  <div className="match-detail-stats">
                    <StatsColumn teamName={homeName} stats={homeStats} />
                    <StatsColumn teamName={awayName} stats={awayStats} />
                  </div>
                </section>
              )}

              {match.referees?.length > 0 && (
                <section className="match-detail-section match-detail-section--muted">
                  <h3 className="match-detail-section-title">Árbitros</h3>
                  <ul className="match-detail-referees">
                    {match.referees.map(r => (
                      <li key={r.id}>{r.name} ({r.type?.replace(/_/g, ' ')})</li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LineupColumn({ teamName, crest, formation, lineup = [], bench = [] }) {
  return (
    <div className="match-detail-lineup-col">
      <div className="match-detail-lineup-head">
        <TeamCrest src={crest} alt={teamName} size={22} />
        <span>{teamName}</span>
        {formation && <span className="match-detail-formation">{formation}</span>}
      </div>
      <ul className="match-detail-players">
        {lineup.map(p => (
          <li key={p.id}>
            <span className="match-detail-shirt">{p.shirtNumber ?? '—'}</span>
            <span className="match-detail-player-name">{p.name}</span>
            {p.position && <span className="match-detail-player-pos">{shortPosition(p.position)}</span>}
          </li>
        ))}
      </ul>
      {bench.length > 0 && (
        <>
          <p className="match-detail-bench-label">Suplentes</p>
          <ul className="match-detail-players match-detail-players--bench">
            {bench.map(p => (
              <li key={p.id}>
                <span className="match-detail-shirt">{p.shirtNumber ?? '—'}</span>
                <span className="match-detail-player-name">{p.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function StatsColumn({ teamName, stats }) {
  if (!stats.length) return null
  return (
    <div className="match-detail-stats-col">
      <p className="match-detail-stats-team">{teamName}</p>
      <dl className="match-detail-stats-list">
        {stats.map(s => (
          <div key={s.key} className="match-detail-stat-row">
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function shortPosition(pos) {
  if (!pos) return ''
  const map = {
    Goalkeeper: 'POR',
    'Centre-Back': 'DFC',
    'Left-Back': 'LI',
    'Right-Back': 'LD',
    'Defensive Midfield': 'MCD',
    'Central Midfield': 'MC',
    'Attacking Midfield': 'MP',
    'Left Winger': 'EI',
    'Right Winger': 'ED',
    'Centre-Forward': 'DC',
  }
  return map[pos] || pos.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
}
