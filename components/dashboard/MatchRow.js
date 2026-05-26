'use client'
import { useRef } from 'react'
import TeamCrest from '../TeamCrest'
import { formatMatchKickoff, formatMatchShortDate } from '../../lib/matchSchedule'
import { focusAwayInRow, focusNextMatchHomeScore } from '../../lib/scheduleScoreFocus'
import ScoreInput from './ScoreInput'

export default function MatchRow({
  home,
  away,
  homeCrest,
  awayCrest,
  utcDate,
  homeVal,
  awayVal,
  onHome,
  onAway,
  locked,
  matchRef,
  readOnly = false,
  compact = false,
  showMatchDate = false,
}) {
  const rowRef = useRef(null)
  const kickoff = formatMatchKickoff(utcDate)
  const matchDate = formatMatchShortDate(utcDate)
  const crestSize = compact ? 22 : 28

  function setRowRef(el) {
    rowRef.current = el
    if (matchRef) matchRef(el)
  }

  return (
    <div
      className={`schedule-match-row${compact ? ' schedule-match-row--compact' : ''}`}
      ref={setRowRef}
    >
      <div className="schedule-match-team schedule-match-team--home">
        <TeamCrest src={homeCrest} alt={home} size={crestSize} />
        <span className="schedule-match-team-name">{home}</span>
      </div>
      <div className="schedule-match-center">
        {readOnly ? (
          <span className="schedule-match-time">{kickoff}</span>
        ) : (
          <>
            <div className="schedule-match-scores">
              <ScoreInput
                value={homeVal}
                onChange={onHome}
                disabled={locked}
                ariaLabel={`Goles ${home}`}
                scoreSide="home"
                onFilled={() => focusAwayInRow(rowRef.current)}
              />
              <ScoreInput
                value={awayVal}
                onChange={onAway}
                disabled={locked}
                ariaLabel={`Goles ${away}`}
                scoreSide="away"
                onFilled={() => focusNextMatchHomeScore(rowRef.current)}
              />
            </div>
            {showMatchDate ? (
              <span className="schedule-match-datetime">
                <span className="schedule-match-date">{matchDate}</span>
                <span className="schedule-match-kickoff">{kickoff}</span>
              </span>
            ) : (
              <span className="schedule-match-kickoff">{kickoff}</span>
            )}
          </>
        )}
      </div>
      <div className="schedule-match-team schedule-match-team--away">
        <TeamCrest src={awayCrest} alt={away} size={crestSize} />
        <span className="schedule-match-team-name">{away}</span>
      </div>
    </div>
  )
}
