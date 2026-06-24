'use client'

import { useEffect, useMemo, useState } from 'react'
import TeamCrest from '../TeamCrest'
import { Icon } from '../icons'

const FILTERS = [
  { id: 'match', label: 'Nota' },
  { id: 'marketValue', label: 'Valor' },
  { id: 'age', label: 'Edad' },
  { id: 'team', label: 'Club' },
]

const MOBILE_LINEUP_MQ = '(max-width: 639px)'

function useVerticalLineupPitch() {
  const [vertical, setVertical] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_LINEUP_MQ).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LINEUP_MQ)
    const sync = () => setVertical(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return vertical
}

function pitchPosition(layout, isHome, vertical) {
  if (!layout) return { left: '50%', top: '50%' }
  // Fotmob horizontalLayout.y is from each team's own perspective; mirror for home on screen.
  const lateralPct = isHome ? (1 - layout.y) * 100 : layout.y * 100
  if (vertical) {
    const topPct = isHome
      ? layout.x * 50
      : 50 + (1 - layout.x) * 50
    return { left: `${lateralPct}%`, top: `${topPct}%` }
  }
  const leftPct = isHome ? layout.x * 50 : (1 - layout.x * 0.5) * 100
  return { left: `${leftPct}%`, top: `${lateralPct}%` }
}

function ratingTone(rating) {
  if (rating == null) return 'neutral'
  if (rating >= 7) return 'high'
  if (rating >= 6) return 'mid'
  return 'low'
}

function formatMarketValue(value) {
  if (value == null) return '—'
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`
  return `€${value}`
}

function filterValue(player, filterId) {
  switch (filterId) {
    case 'marketValue':
      return formatMarketValue(player.marketValue)
    case 'age':
      return player.age != null ? `${player.age}` : '—'
    case 'team':
      return player.club || '—'
    default:
      return player.rating != null ? Number(player.rating).toFixed(1) : '—'
  }
}

function playerLabel(player) {
  const last = player.lastName || player.name?.split(' ').slice(-1)[0] || player.name || ''
  const num = player.shirtNumber ?? ''
  return num ? `${num} ${last}` : last
}

function teamIndicatorFromLineup(lineup, filterId, teamRating) {
  switch (filterId) {
    case 'marketValue': {
      const total = (lineup || []).reduce(
        (sum, p) => sum + (Number(p.marketValue) || 0),
        0,
      )
      if (total <= 0) return null
      return { text: formatMarketValue(total), tone: 'neutral', wide: true }
    }
    case 'age': {
      const ages = (lineup || [])
        .map(p => p.age)
        .filter(a => a != null && Number.isFinite(Number(a)))
      if (!ages.length) return null
      const avg = ages.reduce((sum, age) => sum + Number(age), 0) / ages.length
      return { text: avg.toFixed(1), tone: 'neutral' }
    }
    case 'team':
      return null
    default:
      if (teamRating == null) return null
      return { text: Number(teamRating).toFixed(1), tone: ratingTone(teamRating) }
  }
}

function PitchPlayer({ player, isHome, filterId, vertical, onPlayerClick }) {
  const pos = pitchPosition(player.layout, isHome, vertical)
  const isClubFilter = filterId === 'team'
  const clubCrest = isClubFilter ? player.clubCrest ?? null : null
  const tone = filterId === 'match' ? ratingTone(player.rating) : 'neutral'
  const badge = filterValue(player, filterId)
  const hasGoal = player.events?.includes('goal')
  const hasAssist = player.events?.includes('assist')
  const hasYellow = player.events?.includes('yellowCard')
  const hasRed = player.events?.includes('redCard')
  const clickable = typeof onPlayerClick === 'function' && player.id != null

  const inner = (
    <>
      <div className="lineup-pitch-player-avatar-wrap">
        {player.photoUrl ? (
          <img
            className="lineup-pitch-player-avatar"
            src={player.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <span className="lineup-pitch-player-fallback" aria-hidden="true">
            {player.shirtNumber ?? '?'}
          </span>
        )}
        {clubCrest ? (
          <span className="lineup-pitch-badge lineup-pitch-badge--club" title={player.club || undefined}>
            <TeamCrest src={clubCrest} alt={player.club || ''} size={16} />
          </span>
        ) : badge !== '—' ? (
          <span className={`lineup-pitch-badge lineup-pitch-badge--${tone}`}>{badge}</span>
        ) : null}
        <div className="lineup-pitch-player-events">
          {player.isCaptain && <span className="lineup-pitch-event lineup-pitch-event--captain">C</span>}
          {hasGoal && <span className="lineup-pitch-event lineup-pitch-event--goal"><Icon name="goal" size={10} /></span>}
          {hasAssist && <span className="lineup-pitch-event lineup-pitch-event--assist" title="Asistencia">A</span>}
          {hasYellow && <span className="lineup-pitch-event lineup-pitch-event--yellow" />}
          {hasRed && <span className="lineup-pitch-event lineup-pitch-event--red" />}
        </div>
      </div>
      <span className="lineup-pitch-player-name">{playerLabel(player)}</span>
    </>
  )

  const className = `lineup-pitch-player${hasRed ? ' lineup-pitch-player--sent-off' : ''}${clickable ? ' lineup-pitch-player--clickable' : ''}`

  if (clickable) {
    return (
      <button
        type="button"
        className={className}
        style={{ left: pos.left, top: pos.top }}
        title={player.name}
        aria-label={`Ver ficha de ${player.name}`}
        onClick={() => onPlayerClick(player)}
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      className={className}
      style={{ left: pos.left, top: pos.top }}
      title={player.name}
    >
      {inner}
    </div>
  )
}

function TeamPitchHeader({ teamName, crest, formation, indicator, align }) {
  const ratingClass = indicator
    ? `lineup-pitch-team-rating lineup-pitch-team-rating--${indicator.tone}${indicator.wide ? ' lineup-pitch-team-rating--wide' : ''}`
    : null

  return (
    <div className={`lineup-pitch-team lineup-pitch-team--${align}`}>
      {align === 'home' && indicator && (
        <span className={ratingClass}>{indicator.text}</span>
      )}
      {align === 'home' && <TeamCrest src={crest} alt={teamName} size={20} />}
      <div className="lineup-pitch-team-info">
        <span className="lineup-pitch-team-name">{teamName}</span>
        {formation && <span className="lineup-pitch-formation">{formation}</span>}
      </div>
      {align === 'away' && <TeamCrest src={crest} alt={teamName} size={20} />}
      {align === 'away' && indicator && (
        <span className={ratingClass}>{indicator.text}</span>
      )}
    </div>
  )
}

export default function LineupPitchView({
  homeName,
  awayName,
  homeCrest,
  awayCrest,
  homeFormation,
  awayFormation,
  homeRating,
  awayRating,
  homeLineup = [],
  awayLineup = [],
  availableFilters,
  onPlayerClick,
}) {
  const allowedFilters = useMemo(() => {
    const ids = availableFilters?.length ? availableFilters : ['match', 'marketValue', 'age', 'team']
    return FILTERS.filter(f => ids.includes(f.id))
  }, [availableFilters])

  const [filterId, setFilterId] = useState('match')
  const activeFilter = allowedFilters.some(f => f.id === filterId) ? filterId : 'match'
  const verticalPitch = useVerticalLineupPitch()
  const homeIndicator = useMemo(
    () => teamIndicatorFromLineup(homeLineup, activeFilter, homeRating),
    [homeLineup, activeFilter, homeRating],
  )
  const awayIndicator = useMemo(
    () => teamIndicatorFromLineup(awayLineup, activeFilter, awayRating),
    [awayLineup, activeFilter, awayRating],
  )

  return (
    <div className="lineup-pitch-wrap">
      <div className={`lineup-pitch-header${allowedFilters.length > 1 ? '' : ' lineup-pitch-header--no-filters'}`}>
        <TeamPitchHeader
          teamName={homeName}
          crest={homeCrest}
          formation={homeFormation}
          indicator={homeIndicator}
          align="home"
        />
        {allowedFilters.length > 1 && (
          <div className="lineup-pitch-filters" role="tablist" aria-label="Datos de jugadores">
            {allowedFilters.map(f => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={activeFilter === f.id}
                className={`lineup-pitch-filter${activeFilter === f.id ? ' lineup-pitch-filter--active' : ''}`}
                onClick={() => setFilterId(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <TeamPitchHeader
          teamName={awayName}
          crest={awayCrest}
          formation={awayFormation}
          indicator={awayIndicator}
          align="away"
        />
      </div>

      <div className={`lineup-pitch${verticalPitch ? ' lineup-pitch--vertical' : ''}`}>
        <div className="lineup-pitch-markings" aria-hidden="true">
          <span className="lineup-pitch-box lineup-pitch-box--left" />
          <span className="lineup-pitch-box lineup-pitch-box--right" />
        </div>
        {homeLineup.map(p => (
          <PitchPlayer key={`h-${p.id}`} player={p} isHome filterId={activeFilter} vertical={verticalPitch} onPlayerClick={onPlayerClick} />
        ))}
        {awayLineup.map(p => (
          <PitchPlayer key={`a-${p.id}`} player={p} isHome={false} filterId={activeFilter} vertical={verticalPitch} onPlayerClick={onPlayerClick} />
        ))}
      </div>
    </div>
  )
}
