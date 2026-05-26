'use client'
import { useRef } from 'react'
import TeamCrest from '../TeamCrest'
import { formatMatchKickoff } from '../../lib/matchSchedule'
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
}) {
  const awayInputRef = useRef(null)
  const kickoff = formatMatchKickoff(utcDate)

  return (
    <div className={`schedule-match-row${compact ? ' schedule-match-row--compact' : ''}`} ref={matchRef}>
      <span className="schedule-match-home">{home}</span>
      <TeamCrest src={homeCrest} alt={home} size={24} />
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
                onFilled={() => awayInputRef.current?.focus()}
              />
              <ScoreInput
                ref={awayInputRef}
                value={awayVal}
                onChange={onAway}
                disabled={locked}
                ariaLabel={`Goles ${away}`}
              />
            </div>
            <span className="schedule-match-kickoff">{kickoff}</span>
          </>
        )}
      </div>
      <TeamCrest src={awayCrest} alt={away} size={24} />
      <span className="schedule-match-away">{away}</span>
    </div>
  )
}
