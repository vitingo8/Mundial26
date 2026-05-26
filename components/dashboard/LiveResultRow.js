'use client'

import TeamCrest from '../TeamCrest'
import { formatMatchKickoff, formatMatchShortDate } from '../../lib/matchSchedule'
import { MatchStatus } from '../icons'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'TIMED'])

export default function LiveResultRow({
  home,
  away,
  homeCrest,
  awayCrest,
  utcDate,
  score,
  status,
  userPred,
  compact = false,
  onGoToPrediction,
  onOpenDetail,
  matchRef,
  showMatchDate = false,
}) {
  const isLive = LIVE_STATUSES.has(status)
  const isUpcoming = UPCOMING_STATUSES.has(status)
  const hasScore = score?.home != null && score?.away != null
  const kickoff = formatMatchKickoff(utcDate)
  const matchDate = formatMatchShortDate(utcDate)

  function renderKickoff() {
    if (!showMatchDate) {
      return <span className="schedule-match-kickoff">{kickoff}</span>
    }
    return (
      <span className="schedule-match-datetime">
        <span className="schedule-match-date">{matchDate}</span>
        <span className="schedule-match-kickoff">{kickoff}</span>
      </span>
    )
  }
  const crestSize = compact ? 22 : 28

  const hasFooter = userPred || onGoToPrediction
  const clickable = typeof onOpenDetail === 'function'

  const rowClass = [
    'schedule-match-row',
    compact ? 'schedule-match-row--compact' : '',
    isLive ? 'schedule-match-row--live' : '',
    clickable ? 'schedule-match-row--clickable' : '',
  ].filter(Boolean).join(' ')

  const rowInner = (
    <>
      <div className="schedule-match-team schedule-match-team--home">
        <TeamCrest src={homeCrest} alt={home} size={crestSize} />
        <span className="schedule-match-team-name">{home}</span>
      </div>
      <div className="schedule-match-center">
        {hasScore ? (
          <>
            <div className="schedule-match-result">
              <span className="schedule-match-result-score">{score.home} - {score.away}</span>
            </div>
            {renderKickoff()}
          </>
        ) : (
          showMatchDate ? renderKickoff() : <span className="schedule-match-time">{kickoff}</span>
        )}
        {status && (
          <MatchStatus
            status={status}
            highlight={isLive}
            upcoming={isUpcoming}
          />
        )}
      </div>
      <div className="schedule-match-team schedule-match-team--away">
        <TeamCrest src={awayCrest} alt={away} size={crestSize} />
        <span className="schedule-match-team-name">{away}</span>
      </div>
    </>
  )

  return (
    <div className="schedule-match-row-wrap" ref={matchRef}>
      {clickable ? (
        <button
          type="button"
          className={rowClass}
          onClick={onOpenDetail}
          aria-label={`Ver detalle: ${home} contra ${away}`}
        >
          {rowInner}
        </button>
      ) : (
        <div className={rowClass}>{rowInner}</div>
      )}
      {hasFooter && (
        <div className="schedule-match-live-footer">
          {userPred && (
            <span className="schedule-match-pred">
              Tu porra: {userPred.home ?? '?'}-{userPred.away ?? '?'}
            </span>
          )}
          {onGoToPrediction && (
            <button
              type="button"
              className="schedule-match-pred-link"
              onClick={e => { e.stopPropagation(); onGoToPrediction() }}
            >
              Ver mi predicción →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
