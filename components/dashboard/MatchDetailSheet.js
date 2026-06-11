'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import TeamCrest from '../TeamCrest'
import { Icon, MatchStatus, goalIconName } from '../icons'
import LineupPitchView from './LineupPitchView'
import MatchGroupStandingsPanel from './MatchGroupStandingsPanel'
import { fetchWcMatchClient, formatStageLabel } from '../../lib/footballData'
import {
  formatEventMinute,
  formatLiveClock,
  formatMatchHeaderDate,
  formatMatchRoundLabel,
  getHeaderGoalScorers,
  getMatchDetailScore,
  getUnifiedSubstitutions,
  annotateBenchPlayers,
  isLiveMatchStatus,
  pickStatsComparison,
  pickTeamStatistics,
} from '../../lib/matchDetail'

const LIVE_POLL_MS = 12_000

const DETAIL_TABS = [
  { id: 'directo', label: 'Directo' },
  { id: 'alineacion', label: 'Alineación' },
  { id: 'clasificacion', label: 'Clasificación', groupOnly: true },
  { id: 'stats', label: 'Estadísticas' },
]

function liveSnapshotFromSummary(summary) {
  const raw = summary?.liveSnapshot
  if (!raw?.score?.fullTime) return null
  return raw
}

function mergeLiveIntoMatch(prev, snap) {
  if (!snap?.score?.fullTime) return prev
  if (!prev) return snap
  return {
    ...prev,
    status: snap.status ?? prev.status,
    minute: snap.minute ?? prev.minute,
    liveTime: snap.liveTime ?? prev.liveTime,
    score: snap.score,
  }
}

export default function MatchDetailSheet({
  matchId,
  summary,
  liveSnapshot,
  userPred,
  groupMatches = [],
  apiMatches = [],
  userPreds = {},
  onClose,
}) {
  const [match, setMatch] = useState(() => liveSnapshotFromSummary(summary) || liveSnapshot || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('directo')

  useEffect(() => {
    setMounted(true)
  }, [])

  const load = useCallback(async (force = false) => {
    if (!matchId) return
    setError(null)
    try {
      const data = await fetchWcMatchClient(matchId, { force })
      setMatch(data)
    } catch (e) {
      setError(e.message || 'No se pudo cargar el partido')
    } finally {
      setLoading(false)
    }
  }, [matchId])

  const isGroupStage = match?.stage === 'GROUP_STAGE' || summary?.stage === 'GROUP_STAGE'
    || Boolean(match?.group || summary?.group)
  const showGroupStandings = isGroupStage && groupMatches.length > 0
  const detailTabs = useMemo(
    () => DETAIL_TABS.filter(tab => !tab.groupOnly || showGroupStandings),
    [showGroupStandings],
  )

  useEffect(() => {
    setMatch(liveSnapshotFromSummary(summary) || liveSnapshot || null)
    setLoading(true)
    setError(null)
    load(true)
  }, [load, matchId])

  useEffect(() => {
    setActiveTab('directo')
  }, [matchId])

  useEffect(() => {
    if (detailTabs.some(t => t.id === activeTab)) return
    setActiveTab('directo')
  }, [detailTabs, activeTab])

  useEffect(() => {
    if (!liveSnapshot) return
    setMatch(prev => mergeLiveIntoMatch(prev, liveSnapshot))
  }, [
    liveSnapshot,
    liveSnapshot?.score?.fullTime?.home,
    liveSnapshot?.score?.fullTime?.away,
    liveSnapshot?.status,
    liveSnapshot?.minute,
    liveSnapshot?.liveTime?.short,
  ])

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
    const t = setInterval(() => load(false), LIVE_POLL_MS)
    return () => clearInterval(t)
  }, [match?.status, load])

  const home = match?.homeTeam || {}
  const away = match?.awayTeam || {}
  const homeName = home.shortName || home.name || summary?.home || 'Local'
  const awayName = away.shortName || away.name || summary?.away || 'Visitante'
  const homeCrest = home.crest || summary?.homeCrest
  const awayCrest = away.crest || summary?.awayCrest
  const score = useMemo(() => (match ? getMatchDetailScore(match) : null), [match])
  const liveCommentary = match?.liveCommentary || []
  const homeStats = pickTeamStatistics(home.statistics)
  const awayStats = pickTeamStatistics(away.statistics)
  const statsComparison = useMemo(
    () => pickStatsComparison(match?.statsComparison),
    [match?.statsComparison],
  )
  const hasLineups = (home.lineup?.length || 0) + (away.lineup?.length || 0) > 0
  const substitutions = useMemo(
    () => getUnifiedSubstitutions(match, homeName, awayName),
    [match, homeName, awayName],
  )
  const homeBench = useMemo(
    () => annotateBenchPlayers(home.bench, substitutions, homeName),
    [home.bench, substitutions, homeName],
  )
  const awayBench = useMemo(
    () => annotateBenchPlayers(away.bench, substitutions, awayName),
    [away.bench, substitutions, awayName],
  )
  const benchSubbedOn = homeBench.some(p => p.subOn) || awayBench.some(p => p.subOn)
  const liveClock = useMemo(
    () => formatLiveClock(match?.liveTime, match?.minute, match?.status),
    [match?.liveTime, match?.minute, match?.status],
  )
  const goalScorers = useMemo(
    () => getHeaderGoalScorers(match, homeName, awayName),
    [match, homeName, awayName],
  )
  const roundLabel = match?.roundLabel || formatMatchRoundLabel(match)
    || (match?.stage && match.stage !== 'GROUP_STAGE' ? formatStageLabel(match.stage) : null)
  const referee = match?.referees?.find(r => r.type === 'REFEREE' || !r.type)?.name
  const headerDate = formatMatchHeaderDate(match?.utcDate || summary?.utcDate)
  const isLive = isLiveMatchStatus(match?.status)
  const headerStyle = match?.teamColors
    ? {
        '--md-home-glow': `${match.teamColors.home}40`,
        '--md-away-glow': `${match.teamColors.away}40`,
      }
    : undefined
  const titleId = 'match-detail-title'

  if (!matchId || !mounted) return null

  return createPortal(
    <div
      className="match-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="match-detail-sheet">
        <header className="match-detail-header" style={headerStyle}>
          <div className="match-detail-header-bg" aria-hidden="true" />

          <div className="match-detail-nav">
            <button type="button" className="match-detail-nav-back" onClick={onClose}>
              <Icon name="chevronLeft" size="sm" />
              <span>Partidos</span>
            </button>
            <div className="match-detail-nav-comp">
              <Icon name="trophy" size="sm" />
              <span>
                Copa del Mundo
                {roundLabel && <> · {roundLabel}</>}
              </span>
            </div>
            <button
              type="button"
              className="match-detail-nav-refresh"
              aria-label={loading ? 'Actualizando' : 'Actualizar'}
              onClick={() => { setLoading(true); load(true) }}
              disabled={loading}
            >
              <Icon name="arrowPath" size="sm" />
            </button>
          </div>

          <div className="match-detail-facts">
            {headerDate && (
              <span className="match-detail-fact">
                <Icon name="calendarDays" size="sm" />
                {headerDate}
              </span>
            )}
            {match?.venue && (
              <span className="match-detail-fact">
                <Icon name="buildingLibrary" size="sm" />
                {match.venue}
              </span>
            )}
            {referee && (
              <span className="match-detail-fact">
                <Icon name="user" size="sm" />
                {referee}
              </span>
            )}
          </div>

          <h2 id={titleId} className="match-detail-hero">
            <div className="match-detail-hero-side">
              <div className="match-detail-hero-team-row">
                <span className="match-detail-hero-name">{homeName}</span>
                <TeamCrest src={homeCrest} alt={homeName} size={40} />
              </div>
              {home.fifaRank != null && (
                <span className="match-detail-hero-rank">FIFA #{home.fifaRank}</span>
              )}
              {goalScorers.home.length > 0 && (
                <ul className="match-detail-hero-goals">
                  {goalScorers.home.map((g, i) => (
                    <li key={`hg-${i}`} className="match-detail-hero-goal">
                      {g.name} {g.minute}
                      <Icon name={goalIconName(g.type)} size={14} className="match-detail-hero-goal-icon" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="match-detail-hero-center">
              {score ? (
                <span className="match-detail-hero-score">
                  {score.home} - {score.away}
                </span>
              ) : (
                <span className="match-detail-hero-score match-detail-hero-score--vs">vs</span>
              )}
              {isLive && liveClock ? (
                <div className="match-detail-hero-clock-row">
                  <span className="match-detail-hero-clock">{liveClock.clock}</span>
                  {liveClock.addedTime && (
                    <span className="match-detail-hero-added">{liveClock.addedTime}</span>
                  )}
                </div>
              ) : match?.status === 'FINISHED' ? (
                <span className="match-detail-hero-status">Final</span>
              ) : match?.status ? (
                <MatchStatus status={match.status} highlight={isLive} />
              ) : null}
              {score?.label && (
                <span className="match-detail-hero-status">{score.label}</span>
              )}
            </div>

            <div className="match-detail-hero-side match-detail-hero-side--away">
              <div className="match-detail-hero-team-row">
                <TeamCrest src={awayCrest} alt={awayName} size={40} />
                <span className="match-detail-hero-name">{awayName}</span>
              </div>
              {away.fifaRank != null && (
                <span className="match-detail-hero-rank">FIFA #{away.fifaRank}</span>
              )}
              {goalScorers.away.length > 0 && (
                <ul className="match-detail-hero-goals">
                  {goalScorers.away.map((g, i) => (
                    <li key={`ag-${i}`} className="match-detail-hero-goal">
                      <Icon name={goalIconName(g.type)} size={14} className="match-detail-hero-goal-icon" />
                      {g.name} {g.minute}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </h2>

          {userPred && (
            <p className="match-detail-pred">
              Tu porra: {userPred.home ?? '?'}-{userPred.away ?? '?'}
            </p>
          )}

          <div className="match-detail-tabs" role="tablist" aria-label="Secciones del partido">
            {detailTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`match-detail-tab${activeTab === tab.id ? ' match-detail-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="match-detail-body">
          {loading && !match && (
            <p className="match-detail-empty">Cargando datos en vivo…</p>
          )}
          {error && (
            <p className="match-detail-error" role="alert">{error}</p>
          )}

          {!loading && match && (
            <>
              {activeTab === 'stats' && (match.xg?.home != null || match.xg?.away != null) && (
                <section className="match-detail-section match-detail-section--xg">
                  <h3 className="match-detail-section-title">Goles esperados (xG)</h3>
                  <div className="match-detail-xg-row">
                    <span className="match-detail-xg-team">{homeName}</span>
                    <span className="match-detail-xg-values">
                      {Number(match.xg.home ?? 0).toFixed(2)} – {Number(match.xg.away ?? 0).toFixed(2)}
                    </span>
                    <span className="match-detail-xg-team match-detail-xg-team--away">{awayName}</span>
                  </div>
                </section>
              )}

              {activeTab === 'stats' && statsComparison.length > 0 && (
                <section className="match-detail-section">
                  <h3 className="match-detail-section-title">Estadísticas en vivo</h3>
                  <ul className="match-detail-compare-stats">
                    {statsComparison.map(row => (
                      <CompareStatRow
                        key={row.key}
                        label={row.label}
                        home={row.home}
                        away={row.away}
                        type={row.type}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {activeTab === 'directo' && (
                <section className="match-detail-section match-detail-section--directo">
                  {liveCommentary.length > 0 ? (
                    <ul className="match-detail-feed">
                      {liveCommentary.map(item => (
                        <LiveFeedItem key={item.id} item={item} />
                      ))}
                    </ul>
                  ) : (
                    <p className="match-detail-hint">
                      Sin mensajes todavía. Los eventos aparecen cuando el partido está en juego.
                    </p>
                  )}
                </section>
              )}

              {activeTab === 'alineacion' && (hasLineups ? (
                <section className="match-detail-section match-detail-section--lineup">
                  <LineupPitchView
                    homeName={homeName}
                    awayName={awayName}
                    homeCrest={homeCrest}
                    awayCrest={awayCrest}
                    homeFormation={home.formation}
                    awayFormation={away.formation}
                    homeRating={home.rating}
                    awayRating={away.rating}
                    homeLineup={home.lineup}
                    awayLineup={away.lineup}
                    availableFilters={match?.lineupFilters}
                  />
                  {(homeBench.length > 0 || awayBench.length > 0) && (
                    <>
                      <h3 className="match-detail-section-title match-detail-section-title--bench">
                        {benchSubbedOn ? 'Suplentes y cambios' : 'Suplentes'}
                      </h3>
                      <div className="match-detail-lineups">
                        <LineupColumn
                          teamName={homeName}
                          crest={homeCrest}
                          formation={null}
                          lineup={[]}
                          bench={homeBench}
                        />
                        <LineupColumn
                          teamName={awayName}
                          crest={awayCrest}
                          formation={null}
                          lineup={[]}
                          bench={awayBench}
                        />
                      </div>
                    </>
                  )}
                </section>
              ) : (
                <p className="match-detail-hint">
                  Las alineaciones aparecen cuando FotMob las publica (normalmente cerca del pitido).
                </p>
              ))}

              {activeTab === 'clasificacion' && showGroupStandings && (
                <MatchGroupStandingsPanel
                  groupKey={match?.group || summary?.group}
                  groupMatches={groupMatches}
                  apiMatches={apiMatches}
                  userPreds={userPreds}
                  highlightMatchId={matchId}
                />
              )}

              {activeTab === 'stats' && (homeStats.length > 0 || awayStats.length > 0) && !statsComparison.length && (
                <section className="match-detail-section">
                  <h3 className="match-detail-section-title">Estadísticas</h3>
                  <div className="match-detail-stats">
                    <StatsColumn teamName={homeName} stats={homeStats} />
                    <StatsColumn teamName={awayName} stats={awayStats} />
                  </div>
                </section>
              )}


              <p className="match-detail-source">Datos en vivo vía FotMob</p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function LiveFeedItem({ item }) {
  if (item.feedType === 'fan-take' || item.feedType === 'expert-take') {
    return <TakeFeedCard item={item} />
  }
  if (item.feedType === 'poll') {
    return <PollFeedCard item={item} />
  }
  return <EventFeedCard item={item} />
}

function FeedMinuteBadge({ minute, injuryTime, variant = 'default' }) {
  const label = formatEventMinute(minute, injuryTime)
  return (
    <span className={`feed-minute feed-minute--${variant}`}>{label}</span>
  )
}

function TakeFeedCard({ item }) {
  const minuteLabel = formatEventMinute(item.minute, item.injuryTime)
  const metaPrimary = item.feedType === 'expert-take' ? item.author : item.source
  const metaSecondary = item.feedType === 'expert-take' ? item.source : item.author

  return (
    <li className={`feed-card feed-card--take feed-card--${item.feedType}`}>
      <div className="feed-card-head feed-card-head--take">
        <span className="feed-take-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M8 10h8M8 14h5M6 20l1.5-3H18a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {(metaPrimary || metaSecondary) && (
          <p className="feed-take-meta">
            {metaPrimary && <strong>{metaPrimary}</strong>}
            {metaPrimary && metaSecondary && <span aria-hidden="true"> · </span>}
            {metaSecondary && <span>{metaSecondary}</span>}
          </p>
        )}
        {minuteLabel !== '—' && (
          <span className="feed-take-minute">{minuteLabel}</span>
        )}
      </div>
      <blockquote className="feed-take-quote">{item.text}</blockquote>
      <ReactionRow reactions={item.reactions} />
    </li>
  )
}

function PollFeedCard({ item }) {
  const minuteLabel = formatEventMinute(item.minute, item.injuryTime)
  const maxVotes = Math.max(...(item.options?.map(o => o.votes) || [0]), 1)

  return (
    <li className="feed-card feed-card--poll">
      <div className="feed-card-head">
        {minuteLabel !== '—' && <FeedMinuteBadge minute={item.minute} injuryTime={item.injuryTime} />}
        <h4 className="feed-card-title">{item.question}</h4>
      </div>
      <ul className="feed-poll-options">
        {item.options?.map(opt => (
          <li key={opt.id} className="feed-poll-option">
            <div className="feed-poll-option-row">
              <span>{opt.label}</span>
              {opt.votes > 0 && (
                <span className="feed-poll-option-votes">{opt.votes.toLocaleString('es-ES')}</span>
              )}
            </div>
            {opt.votes > 0 && (
              <span
                className="feed-poll-option-bar"
                style={{ width: `${Math.round((opt.votes / maxVotes) * 100)}%` }}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ul>
      {item.totalVotes > 0 && (
        <p className="feed-poll-footer">
          {item.totalVotes.toLocaleString('es-ES')} votos
          {item.pollOpen ? ' · Encuesta abierta' : ''}
        </p>
      )}
    </li>
  )
}

function EventFeedCard({ item }) {
  const variant = item.variant || 'comment'
  const minuteLabel = formatEventMinute(item.minute, item.injuryTime)
  const showHeader = item.title || variant !== 'comment'
  const badgeVariant = variant === 'red-card' ? 'card-red'
    : variant === 'yellow-card' ? 'card-yellow'
    : variant === 'goal' ? 'goal'
    : (showHeader ? 'pill' : 'plain')

  return (
    <li className={`feed-card feed-card--event feed-card--${variant}`}>
      {showHeader && (
        <div className={`feed-card-banner feed-card-banner--${variant}`}>
          <div className="feed-card-head">
            {minuteLabel !== '—' && (
              <FeedMinuteBadge
                minute={item.minute}
                injuryTime={item.injuryTime}
                variant={badgeVariant}
              />
            )}
            {item.title && <h4 className="feed-card-title">{item.title}</h4>}
          </div>
        </div>
      )}

      <div className="feed-card-body">
        {!showHeader && minuteLabel !== '—' && (
          <p className="feed-comment-minute">{minuteLabel}</p>
        )}

        {item.isSubstitution && item.substitution && (
          <SubstitutionBox sub={item.substitution} />
        )}

        {!item.isSubstitution && item.players?.length > 0 && (
          <PlayerHighlightRow
            player={item.players[0]}
            cardType={variant === 'red-card' ? 'red' : variant === 'yellow-card' ? 'yellow' : null}
          />
        )}

        {item.text && item.text !== item.title && (
          <p className="feed-card-text">{item.text}</p>
        )}

        {item.score && (
          <span className="feed-card-score">
            {item.score.home}-{item.score.away}
          </span>
        )}

        <ReactionRow reactions={item.reactions} />
      </div>
    </li>
  )
}

function PlayerHighlightRow({ player, cardType }) {
  if (!player) return null
  return (
    <div className="feed-player-row">
      <div className="feed-player-info">
        {player.teamCrest && (
          <img className="feed-player-team-crest" src={player.teamCrest} alt="" loading="lazy" />
        )}
        <div>
          <p className="feed-player-name">
            {player.shirtNumber != null && <span>{player.shirtNumber} </span>}
            {player.name}
          </p>
          {player.position && (
            <p className="feed-player-position">{player.position}</p>
          )}
        </div>
      </div>
      {player.photoUrl && (
        <div className={`feed-player-avatar${cardType ? ` feed-player-avatar--${cardType}` : ''}`}>
          <img src={player.photoUrl} alt={player.name} loading="lazy" />
          {cardType === 'red' && <span className="feed-card-badge feed-card-badge--red" aria-hidden="true" />}
          {cardType === 'yellow' && <span className="feed-card-badge feed-card-badge--yellow" aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}

function SubstitutionBox({ sub }) {
  const teamCrest = sub.playerIn?.teamCrest || sub.playerOut?.teamCrest
  return (
    <div className="feed-sub-box">
      <div className="feed-sub-players">
        <SubstitutionPlayerRow player={sub.playerIn} direction="in" />
        <SubstitutionPlayerRow player={sub.playerOut} direction="out" />
      </div>
      {teamCrest && (
        <img className="feed-sub-team-crest" src={teamCrest} alt="" loading="lazy" />
      )}
    </div>
  )
}

function SubstitutionPlayerRow({ player, direction }) {
  if (!player) return null
  return (
    <div className={`feed-sub-player feed-sub-player--${direction}`}>
      <div className="feed-sub-avatar-wrap">
        {player.photoUrl ? (
          <img className="feed-sub-avatar" src={player.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="feed-sub-avatar feed-sub-avatar--placeholder" />
        )}
        <span className={`feed-sub-arrow feed-sub-arrow--${direction}`} aria-hidden="true">
          {direction === 'in' ? '→' : '←'}
        </span>
      </div>
      <p className="feed-sub-name">
        {player.shirtNumber != null && <span>{player.shirtNumber} </span>}
        {player.name}
      </p>
    </div>
  )
}

function ReactionRow({ reactions }) {
  if (!reactions?.length) return null
  return (
    <ul className="feed-reactions" aria-label="Reacciones">
      {reactions.map((r, i) => (
        <li key={`${r.emoji}-${i}`} className="feed-reaction-pill">
          <span className="feed-reaction-emoji">{r.emoji}</span>
          <span className="feed-reaction-count">{r.count.toLocaleString('es-ES')}</span>
        </li>
      ))}
    </ul>
  )
}

function CompareStatRow({ label, home, away, type }) {
  const h = Number(home) || 0
  const a = Number(away) || 0
  const total = h + a || 1
  const homePct = type === 'graph' ? h : Math.round((h / total) * 100)
  const awayPct = type === 'graph' ? a : Math.round((a / total) * 100)

  return (
    <li className="match-detail-compare-row">
      <div className="match-detail-compare-values">
        <span>{home ?? '—'}</span>
        <span className="match-detail-compare-label">{label}</span>
        <span>{away ?? '—'}</span>
      </div>
      <div className="match-detail-compare-bar" aria-hidden="true">
        <span className="match-detail-compare-bar-home" style={{ width: `${homePct}%` }} />
        <span className="match-detail-compare-bar-away" style={{ width: `${awayPct}%` }} />
      </div>
    </li>
  )
}

function BenchPlayerRow({ player }) {
  const subOn = player.subOn
  return (
    <li className={`match-detail-bench-player${subOn ? ' match-detail-bench-player--on' : ''}`}>
      <div className="match-detail-bench-avatar-wrap">
        {player.photoUrl ? (
          <img className="match-detail-bench-avatar" src={player.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="match-detail-bench-avatar match-detail-bench-avatar--placeholder" aria-hidden="true" />
        )}
        {subOn && (
          <span className="match-detail-bench-arrow" aria-hidden="true">→</span>
        )}
      </div>
      <div className="match-detail-bench-body">
        <div className="match-detail-bench-name-row">
          <span className="match-detail-shirt">{player.shirtNumber ?? '—'}</span>
          <span className="match-detail-player-name">{player.name}</span>
        </div>
        {subOn && (
          <p className="match-detail-bench-sub">
            <span className="match-detail-bench-sub-minute">
              {formatEventMinute(subOn.minute, subOn.injuryTime)}
            </span>
            {' · entra por '}
            <span className="match-detail-bench-sub-out">
              {subOn.replaced?.shirtNumber != null && `${subOn.replaced.shirtNumber} `}
              {subOn.replaced?.name || '—'}
            </span>
          </p>
        )}
      </div>
    </li>
  )
}

function LineupColumn({ teamName, crest, formation, lineup = [], bench = [], rating }) {
  if (!lineup.length && !bench.length) return null
  return (
    <div className="match-detail-lineup-col">
      {(lineup.length > 0 || formation || rating != null || bench.length > 0) && (
        <div className="match-detail-lineup-head">
          <TeamCrest src={crest} alt={teamName} size={22} />
          <span>{teamName}</span>
          {formation && <span className="match-detail-formation">{formation}</span>}
          {rating != null && <span className="match-detail-team-rating">{Number(rating).toFixed(1)}</span>}
        </div>
      )}
      {lineup.length > 0 && (
        <ul className="match-detail-players">
          {lineup.map(p => (
            <li key={p.id}>
              <span className="match-detail-shirt">{p.shirtNumber ?? '—'}</span>
              <span className="match-detail-player-name">{p.name}</span>
              {p.rating != null && <span className="match-detail-player-rating">{Number(p.rating).toFixed(1)}</span>}
              {p.position && <span className="match-detail-player-pos">{shortPosition(p.position)}</span>}
            </li>
          ))}
        </ul>
      )}
      {bench.length > 0 && (
        <>
          {lineup.length > 0 && <p className="match-detail-bench-label">Suplentes</p>}
          <ul className="match-detail-players match-detail-players--bench">
            {bench.map(p => (
              <BenchPlayerRow key={p.id} player={p} />
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
    Defender: 'DEF',
    Midfielder: 'MC',
    Forward: 'DEL',
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
