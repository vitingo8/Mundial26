'use client'

import { isMatchKickoffPassed } from '../../lib/deadlines'
import TeamCrest from '../TeamCrest'
import ScoreInput from './ScoreInput'
import { needsKnockoutAdvancePick } from '../../lib/knockoutAdvances'
import { getApiMatchDisplayScore } from '../../lib/apiMatchScores'
import { isLiveMatchStatus, isPorraApiResultStatus } from '../../lib/matchDetail'
import { PorraLiveHeader } from './LiveResultRow'
import { summarizeMatchPoints } from '../../lib/matchPointsDisplay'
import { resolveKnockoutTeamsForScoring } from '../../lib/knockoutMatchScoring'
import MatchPointsBubble from './MatchPointsBubble'
import { MatchStatus } from '../icons'

function BracketTeam({
  name, crest, score, pred, side, onScore, onAdvance, locked, readOnly, pickable, eliminated,
}) {
  const inner = (
    <>
      <span className="bracket-slot-crest">
        <TeamCrest src={crest} alt={name} size={16} />
      </span>
      <span className="bracket-slot-name" title={name}>{name}</span>
      {!readOnly ? (
        <span className="bracket-slot-score-wrap">
          <ScoreInput
            value={pred ?? ''}
            onChange={v => onScore?.(side, v)}
            disabled={locked}
            ariaLabel={`Goles ${name}`}
            scoreSide={side}
          />
        </span>
      ) : score != null ? (
        <span className="bracket-slot-result">{score}</span>
      ) : null}
    </>
  )

  if (!pickable) {
    return <div className="bracket-slot-team">{inner}</div>
  }

  return (
    <button
      type="button"
      className={`bracket-slot-team bracket-slot-team--pick${eliminated ? ' bracket-slot-team--out' : ''}`}
      disabled={locked}
      aria-pressed={!eliminated}
      aria-label={eliminated ? `${name} eliminado` : `${name} pasa de ronda`}
      onClick={() => onAdvance?.(side)}
    >
      {inner}
    </button>
  )
}

export default function BracketMatchSlot({
  match,
  pred = {},
  onScore,
  onAdvance,
  locked = false,
  getMatchLocked,
  readOnly = false,
  apiRaw = null,
  userPred,
  onGoToPrediction,
  matchRef,
  publishedResults = {},
  knockoutScoringCtx = null,
  onOpenMatch,
}) {
  if (!match) return <div className="bracket-slot bracket-slot--empty" />

  const publishedResult = publishedResults[match?.id]
  const scoringTeams = knockoutScoringCtx
    ? resolveKnockoutTeamsForScoring(match.id, publishedResult, knockoutScoringCtx)
    : {}

  const matchLocked = locked || (getMatchLocked ? getMatchLocked(match) : isMatchKickoffPassed(match.utcDate))

  const apiScore = apiRaw ? getApiMatchDisplayScore(apiRaw) : null
  const score = readOnly ? apiScore : null
  const hasScore = score?.home != null && score?.away != null
  const isApiLive = apiRaw && isLiveMatchStatus(apiRaw.status)
  const isApiFinished = apiRaw?.status === 'FINISHED'
  const showPorraHeader = !readOnly && apiRaw && apiScore && isPorraApiResultStatus(apiRaw.status)
  const predRow = {
    home: pred.home === '' || pred.home == null ? null : Number(pred.home),
    away: pred.away === '' || pred.away == null ? null : Number(pred.away),
    advances: pred.advances,
  }
  const pickAdvance =
    !readOnly && !matchLocked && needsKnockoutAdvancePick(predRow) && onAdvance

  const knockoutScoringOpts = {
    knockout: true,
    predictedTeams: scoringTeams.predictedTeams,
    actualTeams: scoringTeams.actualTeams,
  }

  const pointsSummary =
    !readOnly && publishedResult
      ? summarizeMatchPoints(predRow, publishedResult, knockoutScoringOpts)
      : null

  const livePointsSummary =
    isApiLive && apiScore && !publishedResult
      ? summarizeMatchPoints(predRow, apiScore, knockoutScoringOpts)
      : null

  const apiFinishedPointsSummary =
    isApiFinished && apiScore && !publishedResult
      ? summarizeMatchPoints(predRow, apiScore, knockoutScoringOpts)
      : null

  const pointsBubble = (() => {
    if (pointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={pointsSummary.pts}
          detail={pointsSummary.detail}
          publishedResult={publishedResult}
          homeCrest={match.homeCrest}
          awayCrest={match.awayCrest}
          homeName={match.home}
          awayName={match.away}
          className="match-points-bubble-wrap--bracket"
        />
      )
    }
    if (livePointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={livePointsSummary.pts}
          detail={livePointsSummary.detail}
          publishedResult={apiScore}
          homeCrest={match.homeCrest}
          awayCrest={match.awayCrest}
          homeName={match.home}
          awayName={match.away}
          className="match-points-bubble-wrap--bracket"
          provisional
        />
      )
    }
    if (apiFinishedPointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={apiFinishedPointsSummary.pts}
          detail={apiFinishedPointsSummary.detail}
          publishedResult={apiScore}
          homeCrest={match.homeCrest}
          awayCrest={match.awayCrest}
          homeName={match.home}
          awayName={match.away}
          className="match-points-bubble-wrap--bracket"
        />
      )
    }
    return null
  })()

  const slotStateClass =
    (readOnly && apiRaw?.status === 'IN_PLAY') || isApiLive
      ? ' bracket-slot--live'
      : isApiFinished
        ? ' bracket-slot--finished'
        : ''

  return (
    <div
      className={`bracket-slot${slotStateClass}${readOnly && onGoToPrediction ? ' bracket-slot--clickable' : ''}${pointsBubble ? ' bracket-slot--has-points' : ''}`}
      ref={matchRef}
      role={readOnly && onGoToPrediction ? 'button' : undefined}
      tabIndex={readOnly && onGoToPrediction ? 0 : undefined}
      onClick={readOnly && onGoToPrediction ? () => onGoToPrediction(match.id) : undefined}
      onKeyDown={readOnly && onGoToPrediction ? e => { if (e.key === 'Enter') onGoToPrediction(match.id) } : undefined}
    >
      {pointsBubble}
      {showPorraHeader && (
        <PorraLiveHeader
          home={match.home}
          away={match.away}
          score={apiScore}
          status={apiRaw.status}
          liveMinute={apiRaw.liveTime?.short || (apiRaw.minute != null ? `${apiRaw.minute}'` : null)}
          onOpenDetail={onOpenMatch ? () => onOpenMatch(match) : undefined}
          apiRaw={isApiFinished ? apiRaw : null}
          homeLabel={match.home}
          awayLabel={match.away}
        />
      )}
      <div className="bracket-slot-tag">P{match.matchNumber}</div>

      <BracketTeam
        name={match.home}
        crest={match.homeCrest}
        score={hasScore ? score.home : null}
        pred={pred.home}
        side="home"
        onScore={(side, v) => onScore?.(match.id, side, v)}
        onAdvance={() => onAdvance?.(match.id, 'home')}
        locked={matchLocked}
        readOnly={readOnly}
        pickable={!!pickAdvance}
        eliminated={pickAdvance && pred.advances === 'away'}
      />

      <BracketTeam
        name={match.away}
        crest={match.awayCrest}
        score={hasScore ? score.away : null}
        pred={pred.away}
        side="away"
        onScore={(side, v) => onScore?.(match.id, side, v)}
        onAdvance={() => onAdvance?.(match.id, 'away')}
        locked={matchLocked}
        readOnly={readOnly}
        pickable={!!pickAdvance}
        eliminated={pickAdvance && pred.advances === 'home'}
      />

      {readOnly && apiRaw?.status && (
        <MatchStatus status={apiRaw.status} highlight={apiRaw.status === 'IN_PLAY'} />
      )}

      {readOnly && userPred && (
        <div className="bracket-slot-pred">
          Tu porra: {userPred.home ?? '?'}–{userPred.away ?? '?'}
        </div>
      )}

    </div>
  )
}
