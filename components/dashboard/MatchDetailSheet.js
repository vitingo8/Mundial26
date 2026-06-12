'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SwipeTabPanels from '../SwipeTabPanels'
import { createPortal } from 'react-dom'
import TeamCrest from '../TeamCrest'
import { Icon, MatchStatus, goalIconName } from '../icons'
import LineupPitchView from './LineupPitchView'
import MatchGroupStandingsPanel from './MatchGroupStandingsPanel'
import MatchEventsTimeline from './MatchEventsTimeline'
import PlayerDetailSheet from './PlayerDetailSheet'
import YoutubeHighlightsPlayer from './YoutubeHighlightsPlayer'
import { fetchWcMatchClient, formatStageLabel } from '../../lib/footballData'
import { formatStatsTeamName } from '../../lib/teamNamesEs'
import { resolveTeamNamesFromApiRaw } from '../../lib/fifaHighlights'
import { collectMatchPlayerRoster } from '../../lib/playerMatchStats'
import {
  buildMatchEventsTabItems,
  formatEventMinute,
  formatMatchHeaderDate,
  formatMatchRoundLabel,
  getHeaderGoalScorers,
  getMatchDetailScore,
  getUnifiedSubstitutions,
  annotateBenchPlayers,
  enrichPlayerMatchEvents,
  isLiveMatchStatus,
  pickStatsComparison,
  pickTeamStatistics,
} from '../../lib/matchDetail'
import { useSimulatedLiveClock } from '../../hooks/useSimulatedLiveClock'

const LIVE_POLL_MS = 8_000

const DETAIL_TABS = [
  { id: 'directo', label: 'Directo' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'alineacion', label: 'Alineación' },
  { id: 'clasificacion', label: 'Clas.', groupOnly: true },
  { id: 'stats', label: 'Stats' },
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

function makeSheetEntry(matchId, summary, userPred, activeTab = 'directo') {
  return {
    matchId: String(matchId),
    summary,
    userPred,
    activeTab,
  }
}

function summaryFromGroupMatch(m, userPred) {
  return {
    id: m.id,
    home: m.home,
    away: m.away,
    homeCrest: m.homeCrest,
    awayCrest: m.awayCrest,
    utcDate: m.utcDate,
    group: m.group,
    stage: m.stage || 'GROUP_STAGE',
    userPred,
  }
}

function formatHeroGoalLabel(g) {
  const minute = g.minute && g.minute !== '—' ? g.minute : null
  if (!minute && !g.assist) return g.name
  const detail = [minute, g.assist ? `asist. ${g.assist}` : null].filter(Boolean).join(', ')
  return `${g.name} (${detail})`
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
  const [stack, setStack] = useState(() => [makeSheetEntry(matchId, summary, userPred)])
  const currentEntry = stack[stack.length - 1]
  const currentMatchId = currentEntry?.matchId
  const currentSummary = currentEntry?.summary
  const currentUserPred = currentEntry?.userPred
  const canGoBack = stack.length > 1
  const currentLiveSnapshot = useMemo(
    () => apiMatches.find(x => String(x.id) === String(currentMatchId)) || liveSnapshot,
    [apiMatches, currentMatchId, liveSnapshot],
  )

  const [match, setMatch] = useState(
    () => liveSnapshotFromSummary(summary) || liveSnapshot || null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('directo')
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [highlights, setHighlights] = useState(null)
  const bodyRef = useRef(null)
  const sheetRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setStack([makeSheetEntry(matchId, summary, userPred)])
    setActiveTab('directo')
    setSelectedPlayerId(null)
  }, [matchId])

  const load = useCallback(async (force = false) => {
    if (!currentMatchId) return
    setError(null)
    try {
      const data = await fetchWcMatchClient(currentMatchId, { force })
      setMatch(data)
    } catch (e) {
      setError(e.message || 'No se pudo cargar el partido')
    } finally {
      setLoading(false)
    }
  }, [currentMatchId])

  const isGroupStage = match?.stage === 'GROUP_STAGE' || currentSummary?.stage === 'GROUP_STAGE'
    || Boolean(match?.group || currentSummary?.group)
  const showGroupStandings = isGroupStage && groupMatches.length > 0
  const detailTabs = useMemo(
    () => DETAIL_TABS.filter(tab => !tab.groupOnly || showGroupStandings),
    [showGroupStandings],
  )
  const detailTabIds = useMemo(() => detailTabs.map(t => t.id), [detailTabs])

  useEffect(() => {
    setMatch(liveSnapshotFromSummary(currentSummary) || currentLiveSnapshot || null)
    setLoading(true)
    setError(null)
    load(true)
  }, [load, currentMatchId])

  useEffect(() => {
    if (detailTabs.some(t => t.id === activeTab)) return
    setActiveTab('directo')
  }, [detailTabs, activeTab])

  useEffect(() => {
    const el = bodyRef.current?.querySelector('.swipe-tabs-panel[aria-hidden="false"]')
    if (el) el.scrollTop = 0
  }, [activeTab, currentMatchId])

  useEffect(() => {
    if (!currentLiveSnapshot) return
    setMatch(prev => mergeLiveIntoMatch(prev, currentLiveSnapshot))
  }, [
    currentLiveSnapshot,
    currentLiveSnapshot?.score?.fullTime?.home,
    currentLiveSnapshot?.score?.fullTime?.away,
    currentLiveSnapshot?.status,
    currentLiveSnapshot?.minute,
    currentLiveSnapshot?.liveTime?.short,
  ])

  const handleClose = useCallback(() => {
    setStack(prev => {
      if (prev.length > 1) {
        const previous = prev[prev.length - 2]
        setActiveTab(previous.activeTab || 'directo')
        return prev.slice(0, -1)
      }
      onCloseRef.current()
      return prev
    })
  }, [])

  const handleCloseRef = useRef(handleClose)
  handleCloseRef.current = handleClose

  function openGroupMatch(m) {
    if (String(m.id) === String(currentMatchId)) return
    const pred = userPreds[m.id]
    setStack(prev => [
      ...prev.slice(0, -1),
      { ...prev[prev.length - 1], activeTab },
      makeSheetEntry(m.id, summaryFromGroupMatch(m, pred), pred),
    ])
    setActiveTab('directo')
  }

  function selectTab(tabId) {
    setActiveTab(tabId)
    setStack(prev => {
      const next = [...prev]
      next[next.length - 1] = { ...next[next.length - 1], activeTab: tabId }
      return next
    })
  }

  useEffect(() => {
    if (!currentMatchId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') handleCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [currentMatchId])

  useEffect(() => {
    if (!match || !isLiveMatchStatus(match.status)) return
    const t = setInterval(() => load(false), LIVE_POLL_MS)
    return () => clearInterval(t)
  }, [match?.status, load])

  const home = match?.homeTeam || {}
  const away = match?.awayTeam || {}
  const homeName = home.shortName || home.name || currentSummary?.home || 'Local'
  const awayName = away.shortName || away.name || currentSummary?.away || 'Visitante'
  const homeDisplayName = formatStatsTeamName(homeName)
  const awayDisplayName = formatStatsTeamName(awayName)
  const homeCrest = home.crest || currentSummary?.homeCrest
  const awayCrest = away.crest || currentSummary?.awayCrest
  const score = useMemo(() => (match ? getMatchDetailScore(match) : null), [match])
  const liveCommentary = match?.liveCommentary || []
  const highlightTeams = useMemo(
    () => (match ? resolveTeamNamesFromApiRaw(match) : { home: '', away: '' }),
    [match],
  )

  useEffect(() => {
    let cancelled = false
    if (match?.status !== 'FINISHED' || !highlightTeams.home || !highlightTeams.away) {
      setHighlights(null)
      return undefined
    }

    const params = new URLSearchParams({
      home: highlightTeams.home,
      away: highlightTeams.away,
    })
    fetch(`/api/fifa/highlights?${params}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data?.available && data.youtubeId) setHighlights(data)
        else if (!cancelled) setHighlights(null)
      })
      .catch(() => {
        if (!cancelled) setHighlights(null)
      })

    return () => {
      cancelled = true
    }
  }, [match?.status, highlightTeams.home, highlightTeams.away])
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
  const homeLineup = useMemo(
    () => (home.lineup || []).map(p => enrichPlayerMatchEvents(p, match, homeName)),
    [home.lineup, match, homeName],
  )
  const awayLineup = useMemo(
    () => (away.lineup || []).map(p => enrichPlayerMatchEvents(p, match, awayName)),
    [away.lineup, match, awayName],
  )
  const homeBench = useMemo(
    () => annotateBenchPlayers(home.bench, substitutions, homeName, match),
    [home.bench, substitutions, homeName, match],
  )
  const awayBench = useMemo(
    () => annotateBenchPlayers(away.bench, substitutions, awayName, match),
    [away.bench, substitutions, awayName, match],
  )
  const benchSubbedOn = homeBench.some(p => p.subOn) || awayBench.some(p => p.subOn)
  const liveClock = useSimulatedLiveClock({
    liveTime: match?.liveTime,
    minute: match?.minute,
    status: match?.status,
    enabled: isLiveMatchStatus(match?.status),
  })
  const goalScorers = useMemo(
    () => getHeaderGoalScorers(match, homeName, awayName),
    [match, homeName, awayName],
  )
  const eventsTimeline = useMemo(
    () => buildMatchEventsTabItems(match, homeName, awayName),
    [match, homeName, awayName],
  )
  const playerRoster = useMemo(() => collectMatchPlayerRoster(match), [match])

  function openPlayer(player) {
    if (player?.id == null) return
    setSelectedPlayerId(player.id)
  }
  const roundLabel = match?.roundLabel || formatMatchRoundLabel(match)
    || (match?.stage && match.stage !== 'GROUP_STAGE' ? formatStageLabel(match.stage) : null)
  const referee = match?.referees?.find(r => r.type === 'REFEREE' || !r.type)?.name
  const headerDate = formatMatchHeaderDate(match?.utcDate || currentSummary?.utcDate)
  const isLive = isLiveMatchStatus(match?.status)
  const headerStyle = match?.teamColors
    ? {
        '--md-home-glow': `${match.teamColors.home}40`,
        '--md-away-glow': `${match.teamColors.away}40`,
      }
    : undefined
  const titleId = 'match-detail-title'

  if (!currentMatchId || !mounted) return null

  return (
    <>
      {createPortal(
    <div
      className="match-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="match-detail-sheet" ref={sheetRef}>
        <header className="match-detail-header" style={headerStyle}>
          <div className="match-detail-header-bg" aria-hidden="true" />

          <div className="match-detail-nav">
            <button type="button" className="match-detail-nav-back" onClick={handleClose}>
              <Icon name="chevronLeft" size="sm" />
              <span>{canGoBack ? 'Volver' : 'Partidos'}</span>
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
                <span className="match-detail-hero-name">{homeDisplayName}</span>
                <TeamCrest src={homeCrest} alt={homeName} size={40} />
              </div>
              {home.fifaRank != null && (
                <span className="match-detail-hero-rank">FIFA #{home.fifaRank}</span>
              )}
              {goalScorers.home.length > 0 && (
                <ul className="match-detail-hero-goals">
                  {goalScorers.home.map((g, i) => (
                    <li key={`hg-${i}`} className="match-detail-hero-goal">
                      {formatHeroGoalLabel(g)}
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
                <span className="match-detail-hero-name">{awayDisplayName}</span>
              </div>
              {away.fifaRank != null && (
                <span className="match-detail-hero-rank">FIFA #{away.fifaRank}</span>
              )}
              {goalScorers.away.length > 0 && (
                <ul className="match-detail-hero-goals">
                  {goalScorers.away.map((g, i) => (
                    <li key={`ag-${i}`} className="match-detail-hero-goal">
                      <Icon name={goalIconName(g.type)} size={14} className="match-detail-hero-goal-icon" />
                      {formatHeroGoalLabel(g)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </h2>

          {currentUserPred && (
            <p className="match-detail-pred">
              Tu porra: {currentUserPred.home ?? '?'}-{currentUserPred.away ?? '?'}
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
                onClick={() => selectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="match-detail-body" ref={bodyRef}>
          {loading && !match && (
            <p className="match-detail-empty">Cargando datos en vivo…</p>
          )}
          {error && (
            <p className="match-detail-error" role="alert">{error}</p>
          )}

          {!loading && match && (
            <SwipeTabPanels
              tabs={detailTabIds}
              activeTab={activeTab}
              onChange={selectTab}
              enabled={!selectedPlayerId}
              panelScroll
              viewportClassName="match-detail-swipe-viewport"
              panels={{
                stats: (
                  <>
                    {(match.xg?.home != null || match.xg?.away != null) && (
                      <section className="match-detail-section match-detail-section--xg">
                        <h3 className="match-detail-section-title">Goles esperados (xG)</h3>
                        <div className="match-detail-xg-row">
                          <span className="match-detail-xg-team">{homeDisplayName}</span>
                          <span className="match-detail-xg-values">
                            {Number(match.xg.home ?? 0).toFixed(2)} – {Number(match.xg.away ?? 0).toFixed(2)}
                          </span>
                          <span className="match-detail-xg-team match-detail-xg-team--away">{awayDisplayName}</span>
                        </div>
                      </section>
                    )}
                    {statsComparison.length > 0 && (
                      <section className="match-detail-section">
                        <h3 className="match-detail-section-title">Estadísticas en vivo</h3>
                        <div className="match-detail-compare-teams" aria-hidden="true">
                          <span>{homeDisplayName}</span>
                          <span>{awayDisplayName}</span>
                        </div>
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
                    {(homeStats.length > 0 || awayStats.length > 0) && !statsComparison.length && (
                      <section className="match-detail-section">
                        <h3 className="match-detail-section-title">Estadísticas</h3>
                        <div className="match-detail-stats">
                          <StatsColumn teamName={homeDisplayName} stats={homeStats} />
                          <StatsColumn teamName={awayDisplayName} stats={awayStats} />
                        </div>
                      </section>
                    )}
                  </>
                ),
                eventos: (
                  <MatchEventsTimeline items={eventsTimeline} onPlayerClick={openPlayer} />
                ),
                directo: (
                  <section className="match-detail-section match-detail-section--directo">
                    {liveCommentary.length > 0 || highlights?.youtubeId ? (
                      <ul className="match-detail-feed">
                        {highlights?.youtubeId && (
                          <li className="feed-card feed-card--highlights">
                            <div className="feed-highlights-player-wrap">
                              <YoutubeHighlightsPlayer
                                videoId={highlights.youtubeId}
                                title={`Resumen: ${homeName} vs ${awayName}`}
                                className="feed-highlights-player"
                              />
                            </div>
                          </li>
                        )}
                        {liveCommentary.map(item => (
                          <LiveFeedItem key={item.id} item={item} onPlayerClick={openPlayer} />
                        ))}
                      </ul>
                    ) : (
                      <p className="match-detail-hint">
                        Sin mensajes todavía. Los eventos aparecen cuando el partido está en juego.
                      </p>
                    )}
                  </section>
                ),
                alineacion: hasLineups ? (
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
                      homeLineup={homeLineup}
                      awayLineup={awayLineup}
                      availableFilters={match?.lineupFilters}
                      onPlayerClick={openPlayer}
                    />
                    {(homeBench.length > 0 || awayBench.length > 0) && (
                      <>
                        <h3 className="match-detail-section-title match-detail-section-title--bench">
                          {benchSubbedOn ? 'Suplentes y cambios' : 'Suplentes'}
                        </h3>
                        <div className="match-detail-bench-grid">
                          <BenchGrid
                            homeName={homeName}
                            awayName={awayName}
                            homeCrest={homeCrest}
                            awayCrest={awayCrest}
                            homeBench={homeBench}
                            awayBench={awayBench}
                            onPlayerClick={openPlayer}
                          />
                        </div>
                      </>
                    )}
                  </section>
                ) : (
                  <p className="match-detail-hint">
                    Las alineaciones aparecen cuando estén disponibles (normalmente cerca del pitido).
                  </p>
                ),
                clasificacion: showGroupStandings ? (
                  <MatchGroupStandingsPanel
                    groupKey={match?.group || currentSummary?.group}
                    groupMatches={groupMatches}
                    apiMatches={apiMatches}
                    userPreds={userPreds}
                    highlightMatchId={currentMatchId}
                    onOpenMatch={openGroupMatch}
                  />
                ) : null,
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
      )}
      {selectedPlayerId && (
        <PlayerDetailSheet
          match={match}
          matchId={currentMatchId}
          playerId={selectedPlayerId}
          roster={playerRoster}
          onClose={() => setSelectedPlayerId(null)}
          onChangePlayer={setSelectedPlayerId}
        />
      )}
    </>
  )
}

function LiveFeedItem({ item, onPlayerClick }) {
  if (item.feedType === 'fan-take' || item.feedType === 'expert-take') {
    return <TakeFeedCard item={item} />
  }
  if (item.feedType === 'poll') {
    return <PollFeedCard item={item} />
  }
  return <EventFeedCard item={item} onPlayerClick={onPlayerClick} />
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

function EventFeedCard({ item, onPlayerClick }) {
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
          <SubstitutionBox sub={item.substitution} onPlayerClick={onPlayerClick} />
        )}

        {!item.isSubstitution && item.players?.length > 0 && (
          <PlayerHighlightRow
            player={item.players[0]}
            cardType={variant === 'red-card' ? 'red' : variant === 'yellow-card' ? 'yellow' : null}
            onPlayerClick={onPlayerClick}
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

function PlayerHighlightRow({ player, cardType, onPlayerClick }) {
  if (!player) return null
  const clickable = typeof onPlayerClick === 'function' && player.id != null
  const inner = (
    <>
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
    </>
  )

  if (clickable) {
    return (
      <button
        type="button"
        className="feed-player-row feed-player-row--clickable"
        onClick={() => onPlayerClick(player)}
        aria-label={`Ver ficha de ${player.name}`}
      >
        {inner}
      </button>
    )
  }

  return <div className="feed-player-row">{inner}</div>
}

function SubstitutionBox({ sub, onPlayerClick }) {
  const teamCrest = sub.playerIn?.teamCrest || sub.playerOut?.teamCrest
  return (
    <div className="feed-sub-box">
      <div className="feed-sub-players">
        <SubstitutionPlayerRow player={sub.playerIn} direction="in" onPlayerClick={onPlayerClick} />
        <SubstitutionPlayerRow player={sub.playerOut} direction="out" onPlayerClick={onPlayerClick} />
      </div>
      {teamCrest && (
        <img className="feed-sub-team-crest" src={teamCrest} alt="" loading="lazy" />
      )}
    </div>
  )
}

function SubstitutionPlayerRow({ player, direction, onPlayerClick }) {
  if (!player) return null
  const clickable = typeof onPlayerClick === 'function' && player.id != null
  const inner = (
    <>
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
    </>
  )

  if (clickable) {
    return (
      <button
        type="button"
        className={`feed-sub-player feed-sub-player--${direction} feed-sub-player--clickable`}
        onClick={() => onPlayerClick(player)}
        aria-label={`Ver ficha de ${player.name}`}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={`feed-sub-player feed-sub-player--${direction}`}>
      {inner}
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

function BenchPlayerRow({ player, onPlayerClick }) {
  const subOn = player.subOn
  const sentOff = player.sentOff
  const hasGoal = player.events?.includes('goal')
  const hasAssist = player.events?.includes('assist')
  const hasYellow = player.events?.includes('yellowCard')
  const hasRed = player.events?.includes('redCard') || sentOff
  const clickable = typeof onPlayerClick === 'function' && player.id != null
  const rowClass = [
    'match-detail-bench-player',
    subOn ? 'match-detail-bench-player--on' : '',
    sentOff ? 'match-detail-bench-player--sent-off' : '',
    clickable ? 'match-detail-bench-player--clickable' : '',
  ].filter(Boolean).join(' ')

  const inner = (
    <>
      <div className="match-detail-bench-avatar-wrap">
        {player.photoUrl ? (
          <img className="match-detail-bench-avatar" src={player.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="match-detail-bench-avatar match-detail-bench-avatar--placeholder" aria-hidden="true" />
        )}
        {subOn && !sentOff && (
          <span className="match-detail-bench-arrow" aria-hidden="true">→</span>
        )}
        <div className="match-detail-bench-events">
          {hasGoal && (
            <span className="match-detail-bench-event match-detail-bench-event--goal" title="Gol" aria-hidden="true">
              <Icon name="goal" size={10} />
            </span>
          )}
          {hasAssist && (
            <span className="match-detail-bench-event match-detail-bench-event--assist" title="Asistencia" aria-hidden="true">A</span>
          )}
          {hasYellow && !hasRed && (
            <span className="match-detail-bench-event match-detail-bench-event--yellow" aria-hidden="true" />
          )}
          {hasRed && (
            <span className="match-detail-bench-event match-detail-bench-event--red" aria-hidden="true" />
          )}
        </div>
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
        {(hasGoal || hasAssist) && (
          <p className="match-detail-bench-sub match-detail-bench-sub--contributions">
            {hasGoal && hasAssist ? 'Gol y asistencia' : hasGoal ? 'Gol' : 'Asistencia'}
          </p>
        )}
        {sentOff && !subOn && (
          <p className="match-detail-bench-sub match-detail-bench-sub--sent-off">Expulsado</p>
        )}
      </div>
    </>
  )

  if (clickable) {
    return (
      <li>
        <button
          type="button"
          className={rowClass}
          onClick={() => onPlayerClick(player)}
          aria-label={`Ver ficha de ${player.name}`}
        >
          {inner}
        </button>
      </li>
    )
  }

  return (
    <li className={rowClass}>
      {inner}
    </li>
  )
}

function BenchGrid({
  homeName,
  awayName,
  homeCrest,
  awayCrest,
  homeBench,
  awayBench,
  onPlayerClick,
}) {
  const homeSubs = homeBench.filter(p => p.subOn)
  const homeRest = homeBench.filter(p => !p.subOn)
  const awaySubs = awayBench.filter(p => p.subOn)
  const awayRest = awayBench.filter(p => !p.subOn)
  const showDivider = (homeSubs.length > 0 || awaySubs.length > 0)
    && (homeRest.length > 0 || awayRest.length > 0)

  return (
    <>
      <div className="match-detail-lineup-head match-detail-bench-team-head">
        <TeamCrest src={homeCrest} alt={homeName} size={22} />
        <span>{homeName}</span>
      </div>
      <div className="match-detail-lineup-head match-detail-bench-team-head">
        <TeamCrest src={awayCrest} alt={awayName} size={22} />
        <span>{awayName}</span>
      </div>

      <ul className="match-detail-players match-detail-players--bench match-detail-bench-subs">
        {homeSubs.map(p => (
          <BenchPlayerRow key={p.id} player={p} onPlayerClick={onPlayerClick} />
        ))}
      </ul>
      <ul className="match-detail-players match-detail-players--bench match-detail-bench-subs">
        {awaySubs.map(p => (
          <BenchPlayerRow key={p.id} player={p} onPlayerClick={onPlayerClick} />
        ))}
      </ul>

      {showDivider && (
        <div className="match-detail-bench-divider-row" aria-hidden="true" />
      )}

      <ul className="match-detail-players match-detail-players--bench match-detail-bench-rest">
        {homeRest.map(p => (
          <BenchPlayerRow key={p.id} player={p} onPlayerClick={onPlayerClick} />
        ))}
      </ul>
      <ul className="match-detail-players match-detail-players--bench match-detail-bench-rest">
        {awayRest.map(p => (
          <BenchPlayerRow key={p.id} player={p} onPlayerClick={onPlayerClick} />
        ))}
      </ul>
    </>
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
