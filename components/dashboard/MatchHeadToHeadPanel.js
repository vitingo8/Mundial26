'use client'

import { useMemo, useState } from 'react'
import TeamCrest from '../TeamCrest'
import { Icon } from '../icons'
import { isTournamentH2hCompetition } from '../../lib/matchHeadToHead'

function SummaryStat({ crest, crestAlt, value, label, variant, accentColor }) {
  const style = accentColor ? { '--h2h-stat-accent': accentColor } : undefined
  return (
    <div className="match-h2h-stat" style={style}>
      {crest && (
        <TeamCrest src={crest} alt={crestAlt || ''} size={28} className="match-h2h-stat-crest" />
      )}
      <span className={`match-h2h-stat-bubble match-h2h-stat-bubble--${variant}`}>{value}</span>
      <span className="match-h2h-stat-label">{label}</span>
    </div>
  )
}

function CompetitionBadge({ label, rawName }) {
  const isTournament = isTournamentH2hCompetition(rawName || label)
  return (
    <span className="match-h2h-comp">
      <Icon
        name={isTournament ? 'trophy' : 'signal'}
        size="sm"
        className="match-h2h-comp-icon"
        aria-hidden
      />
      <span className="match-h2h-comp-label">{label}</span>
    </span>
  )
}

export default function MatchHeadToHeadPanel({
  headToHead,
  homeName,
  awayName,
  homeCrest,
  awayCrest,
  teamColors,
  loading = false,
  emptyHint = 'No hay enfrentamientos previos registrados entre estos equipos.',
  hideWhenEmpty = false,
}) {
  const [filter, setFilter] = useState('all')

  const displayHome = homeName || headToHead?.homeName || 'Local'
  const displayAway = awayName || headToHead?.awayName || 'Visitante'

  const filteredMatches = useMemo(() => {
    const rows = headToHead?.matches || []
    if (filter === 'tournament') {
      return rows.filter(row => isTournamentH2hCompetition(row.competitionRaw || row.competition))
    }
    return rows
  }, [headToHead?.matches, filter])

  const hasTournamentRows = useMemo(
    () => (headToHead?.matches || []).some(row => isTournamentH2hCompetition(row.competitionRaw || row.competition)),
    [headToHead?.matches],
  )

  if (loading) {
    return hideWhenEmpty ? null : <p className="match-detail-hint">Cargando historial…</p>
  }

  if (!headToHead?.matches?.length) {
    return hideWhenEmpty ? null : <p className="match-detail-hint">{emptyHint}</p>
  }

  const { homeWins, draws, awayWins } = headToHead
  const homeColor = teamColors?.home
  const awayColor = teamColors?.away

  return (
    <section className="match-detail-section match-detail-section--h2h" aria-label="Cara a cara">
      <div className="match-h2h-summary">
        <SummaryStat
          crest={homeCrest}
          crestAlt={displayHome}
          value={homeWins}
          label="Victorias"
          variant="home"
          accentColor={homeColor}
        />
        <SummaryStat
          value={draws}
          label="Empates"
          variant="draw"
        />
        <SummaryStat
          crest={awayCrest}
          crestAlt={displayAway}
          value={awayWins}
          label="Victorias"
          variant="away"
          accentColor={awayColor}
        />
      </div>

      {hasTournamentRows && (
        <div className="match-h2h-filters" role="tablist" aria-label="Filtrar historial">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`match-h2h-filter${filter === 'all' ? ' match-h2h-filter--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'tournament'}
            className={`match-h2h-filter${filter === 'tournament' ? ' match-h2h-filter--active' : ''}`}
            onClick={() => setFilter('tournament')}
          >
            <Icon name="trophy" size="sm" aria-hidden />
            Este torneo
          </button>
        </div>
      )}

      {filteredMatches.length === 0 ? (
        <p className="match-detail-hint">No hay partidos en este torneo entre estos equipos.</p>
      ) : (
        <ol className="match-h2h-list">
          {filteredMatches.map(row => (
            <li key={row.id} className="match-h2h-row">
              <time className="match-h2h-row-date" dateTime={row.utcDate || undefined}>
                {row.dateLabel}
              </time>
              <div className="match-h2h-row-match">
                <span className="match-h2h-row-team match-h2h-row-team--left">{row.home.name}</span>
                <TeamCrest src={row.home.crest} alt="" size={18} className="match-h2h-row-crest" />
                <span className="match-h2h-row-score">{row.scoreLabel}</span>
                <TeamCrest src={row.away.crest} alt="" size={18} className="match-h2h-row-crest" />
                <span className="match-h2h-row-team match-h2h-row-team--right">{row.away.name}</span>
              </div>
              {row.competition && (
                <CompetitionBadge label={row.competition} rawName={row.competitionRaw} />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
