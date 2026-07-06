'use client'

import { useMemo, useRef } from 'react'
import { isMatchKickoffPassed } from '../../lib/deadlines'
import TeamCrest from '../TeamCrest'
import ScoreInput from './ScoreInput'
import { focusAwayInRow, focusNextMatchHomeScore } from '../../lib/scheduleScoreFocus'
import { needsKnockoutAdvancePick, resolveKnockoutAdvanceSide } from '../../lib/knockoutAdvances'
import { getApiMatchDisplayScore } from '../../lib/apiMatchScores'
import { isLiveMatchStatus, isPorraApiResultStatus } from '../../lib/matchDetail'
import { isFotmobCatalogMatchId, isMatchNotStarted } from '../../lib/matchHeadToHead'
import { PorraLiveHeader } from './LiveResultRow'
import { summarizeMatchPoints, isInicioKoId } from '../../lib/matchPointsDisplay'
import { isExactScoreHit } from '../../lib/gameData'
import {
  getInicioKnockoutUiStatus,
  summarizeInicioKnockoutMatchPoints,
} from '../../lib/inicioKnockoutScoring'
import { resolveKnockoutTeamsForScoring } from '../../lib/knockoutMatchScoring'
import MatchPointsBubble from './MatchPointsBubble'
import MatchPredsInfo from './MatchPredsInfo'
import MatchH2hInfo from './MatchH2hInfo'
import { getParticipantPredsForMatch } from '../../lib/participantMatchPreds'
import { MatchStatus } from '../icons'

function BracketTeam({
  name, crest, score, pred, side, onScore, onAdvance, locked, readOnly, pickable, eliminated,
  scoreExact = false, pendingThird = false, pendingThirdSlot = null, voided = false,
  advanceBadge = false, onFilled,
}) {
  const inner = (
    <>
      <span className={`bracket-slot-crest${voided ? ' bracket-slot-crest--void' : ''}`}>
        {pendingThird ? (
          <span
            className="bracket-slot-pending-dot"
            title={pendingThirdSlot ? `Mejor tercero: ${pendingThirdSlot}` : 'Mejor tercero por confirmar'}
            aria-label="Tercero por confirmar"
          />
        ) : (
          <TeamCrest src={crest} alt={name} size={12} />
        )}
      </span>
      <span className={`bracket-slot-name${voided ? ' bracket-slot-name--void' : ''}${advanceBadge ? ' bracket-slot-name--advances' : ''}`} title={pendingThirdSlot || name}>
        {name}
        {advanceBadge && crest ? (
          <span className="bracket-slot-advance-crest" title="Pasa de ronda" aria-hidden>
            <TeamCrest src={crest} alt="" size={9} />
          </span>
        ) : null}
      </span>
      {!readOnly ? (
        <span className={`bracket-slot-score-wrap${scoreExact ? ' bracket-slot-score-wrap--exact' : ''}`}>
          <ScoreInput
            value={pred ?? ''}
            onChange={v => onScore?.(side, v)}
            disabled={locked}
            ariaLabel={`Goles ${name}`}
            scoreSide={side}
            onFilled={onFilled}
          />
        </span>
      ) : score != null ? (
        <span className="bracket-slot-result">{score}</span>
      ) : null}
    </>
  )

  if (!pickable) {
    return <div className={`bracket-slot-team${voided ? ' bracket-slot-team--void' : ''}`}>{inner}</div>
  }

  return (
    <button
      type="button"
      className={`bracket-slot-team bracket-slot-team--pick${eliminated ? ' bracket-slot-team--out' : ''}${voided ? ' bracket-slot-team--void' : ''}`}
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
  participants = null,
  groupMatches = [],
  knockoutMatches = [],
  viewingParticipantPreds = false,
  inicioKnockoutScoring = null,
  knockoutAdvance = false,
}) {
  const slotRowRef = useRef(null)

  if (!match) return <div className="bracket-slot bracket-slot--empty" />

  const publishedResult = publishedResults[match?.id]
  const scoringTeams = knockoutScoringCtx
    ? resolveKnockoutTeamsForScoring(match.id, publishedResult, knockoutScoringCtx)
    : {}

  const matchLocked =
    locked ||
    match?.pendingThirdMatch ||
    (getMatchLocked ? getMatchLocked(match) : isMatchKickoffPassed(match.utcDate))

  const apiScore = apiRaw ? getApiMatchDisplayScore(apiRaw) : null
  const predRow = {
    home: pred.home === '' || pred.home == null ? null : Number(pred.home),
    away: pred.away === '' || pred.away == null ? null : Number(pred.away),
    advances: pred.advances,
  }
  const showParticipantPredScores = readOnly && viewingParticipantPreds
  const score = showParticipantPredScores
    ? null
    : readOnly
      ? apiScore
      : null
  const hasApiScore = score?.home != null && score?.away != null
  const homeSlotScore = showParticipantPredScores
    ? predRow.home
    : hasApiScore
      ? score.home
      : null
  const awaySlotScore = showParticipantPredScores
    ? predRow.away
    : hasApiScore
      ? score.away
      : null
  const isApiLive = apiRaw && isLiveMatchStatus(apiRaw.status)
  const isApiFinished = apiRaw?.status === 'FINISHED'
  const showPorraHeader = !readOnly && apiRaw && apiScore && isPorraApiResultStatus(apiRaw.status)
  const pickAdvance =
    !readOnly && !matchLocked && needsKnockoutAdvancePick(predRow) && onAdvance
  const advanceSide = knockoutAdvance ? resolveKnockoutAdvanceSide(predRow) : null

  const isInicioKo = isInicioKoId(match?.id)

  const inicioKoUiStatus = useMemo(() => {
    if (!isInicioKo || !inicioKnockoutScoring || !match) return null
    return getInicioKnockoutUiStatus(
      match.home,
      match.away,
      match.matchNumber,
      inicioKnockoutScoring,
    )
  }, [isInicioKo, inicioKnockoutScoring, match])

  const inicioKoVoid = inicioKoUiStatus?.void === true

  const knockoutScoringOpts = {
    knockout: true,
    predictedTeams: scoringTeams.predictedTeams,
    actualTeams: scoringTeams.actualTeams,
  }

  const pointsSummary = useMemo(() => {
    if (!readOnly && !viewingParticipantPreds) return null
    if (inicioKoVoid) return null
    if (isInicioKo && inicioKnockoutScoring) {
      return summarizeInicioKnockoutMatchPoints(
        predRow,
        { home: match.home, away: match.away },
        inicioKnockoutScoring,
        match.matchNumber,
      )
    }
    if (!publishedResult) return null
    return summarizeMatchPoints(predRow, publishedResult, knockoutScoringOpts)
  }, [readOnly, viewingParticipantPreds, inicioKoVoid, isInicioKo, inicioKnockoutScoring, publishedResult, predRow, match?.home, match?.away, knockoutScoringOpts])

  const livePointsSummary = useMemo(() => {
    if (inicioKoVoid) return null
    if (isInicioKo && inicioKnockoutScoring) {
      if (!isApiLive || !apiScore || publishedResult) return null
      return summarizeInicioKnockoutMatchPoints(
        predRow,
        { home: match.home, away: match.away },
        inicioKnockoutScoring,
        match.matchNumber,
      )
    }
    if (!isApiLive || !apiScore || publishedResult) return null
    return summarizeMatchPoints(predRow, apiScore, knockoutScoringOpts)
  }, [inicioKoVoid, isInicioKo, inicioKnockoutScoring, isApiLive, apiScore, publishedResult, predRow, match?.home, match?.away, knockoutScoringOpts])

  const apiFinishedPointsSummary = useMemo(() => {
    if (inicioKoVoid) return null
    if (isInicioKo && inicioKnockoutScoring) {
      if (!isApiFinished || !apiScore || publishedResult) return null
      return summarizeInicioKnockoutMatchPoints(
        predRow,
        { home: match.home, away: match.away },
        inicioKnockoutScoring,
        match.matchNumber,
      )
    }
    if (!isApiFinished || !apiScore || publishedResult) return null
    return summarizeMatchPoints(predRow, apiScore, knockoutScoringOpts)
  }, [inicioKoVoid, isInicioKo, inicioKnockoutScoring, isApiFinished, apiScore, publishedResult, predRow, match?.home, match?.away, knockoutScoringOpts])

  const resultForCompare = publishedResult || apiScore || null
  const isExactHit = inicioKoVoid
    ? false
    : isInicioKo && inicioKnockoutScoring
      ? (summarizeInicioKnockoutMatchPoints(
        predRow,
        { home: match.home, away: match.away },
        inicioKnockoutScoring,
        match.matchNumber,
      )?.split?.resultado ?? 0) > 0
      : isExactScoreHit(predRow, resultForCompare, knockoutScoringOpts)

  const participantPredRows = useMemo(() => {
    if (readOnly || !participants || !match?.id) return []
    return getParticipantPredsForMatch(participants, match.id, {
      groupMatches,
      knockoutMatches,
      match: {
        home: match.home,
        away: match.away,
        homeCrest: match.homeCrest,
        awayCrest: match.awayCrest,
      },
    })
  }, [readOnly, participants, match?.id, groupMatches, knockoutMatches, match?.home, match?.away, match?.homeCrest, match?.awayCrest])

  const bubbleUserPred = viewingParticipantPreds ? predRow : null
  const bubbleProps = {
    userPrediction: bubbleUserPred,
    highlightPrediction: viewingParticipantPreds,
    homeCrest: match.homeCrest,
    awayCrest: match.awayCrest,
    homeName: match.home,
    awayName: match.away,
    className: 'match-points-bubble-wrap--bracket',
  }

  const voidZeroBubble = inicioKoVoid ? (
    <MatchPointsBubble
      points={0}
      detail="No se enfrentaron en la realidad"
      publishedResult={publishedResult}
      {...bubbleProps}
      userPrediction={bubbleUserPred || predRow}
    />
  ) : null

  const inlinePointsBubble = (() => {
    if (inicioKoVoid) return null
    if (pointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={pointsSummary.pts}
          detail={pointsSummary.detail}
          publishedResult={publishedResult}
          {...bubbleProps}
        />
      )
    }
    if (livePointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={livePointsSummary.pts}
          detail={livePointsSummary.detail}
          publishedResult={apiScore}
          {...bubbleProps}
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
          {...bubbleProps}
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
        : inicioKoVoid
          ? ' bracket-slot--void'
          : ''

  const shellClass = [
    'bracket-slot-shell',
    voidZeroBubble ? 'bracket-slot-shell--has-zero' : '',
    inlinePointsBubble ? 'bracket-slot-shell--has-points' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={shellClass} ref={matchRef}>
      {voidZeroBubble && (
        <div className="bracket-slot-bubble-overlay" aria-hidden="false">
          <div className="bracket-slot-tag-row bracket-slot-tag-row--mirror" aria-hidden="true">
            <div className="bracket-slot-tag">P{match.matchNumber}</div>
            {!readOnly && participantPredRows.length > 0 && (
              <MatchPredsInfo rows={participantPredRows} className="match-preds-info-wrap--bracket" />
            )}
          </div>
          <div className="bracket-slot-scores-wrap bracket-slot-scores-wrap--has-points">
            {voidZeroBubble}
          </div>
        </div>
      )}
      <div
      className={`bracket-slot${slotStateClass}${readOnly && onGoToPrediction ? ' bracket-slot--clickable' : ''}${inlinePointsBubble ? ' bracket-slot--has-points' : ''}`}
      ref={slotRowRef}
      role={readOnly && onGoToPrediction ? 'button' : undefined}
      tabIndex={readOnly && onGoToPrediction ? 0 : undefined}
      onClick={readOnly && onGoToPrediction ? () => onGoToPrediction(match.id) : undefined}
      onKeyDown={readOnly && onGoToPrediction ? e => { if (e.key === 'Enter') onGoToPrediction(match.id) } : undefined}
    >
      {showPorraHeader && (
        <PorraLiveHeader
          home={match.home}
          away={match.away}
          score={apiScore}
          status={apiRaw.status}
          liveTime={apiRaw.liveTime}
          minute={apiRaw.minute}
          onOpenDetail={onOpenMatch ? () => onOpenMatch(match) : undefined}
          apiRaw={isApiFinished ? apiRaw : null}
          homeLabel={match.home}
          awayLabel={match.away}
          scoreOnly
        />
      )}
      <div className="bracket-slot-tag-row">
        <div className="bracket-slot-tag">P{match.matchNumber}</div>
        <span className="schedule-match-tag-icons">
          {!readOnly && participantPredRows.length > 0 && (
            <MatchPredsInfo rows={participantPredRows} className="match-preds-info-wrap--bracket" />
          )}
        </span>
      </div>

      <div className={`bracket-slot-scores-wrap${inlinePointsBubble ? ' bracket-slot-scores-wrap--has-points' : ''}`}>
        {inlinePointsBubble}

        <BracketTeam
        name={match.home}
        crest={match.homeCrest}
        score={homeSlotScore}
        pred={pred.home}
        side="home"
        onScore={(side, v) => onScore?.(match.id, side, v)}
        onAdvance={() => onAdvance?.(match.id, 'home')}
        locked={matchLocked}
        readOnly={readOnly}
        pickable={!!pickAdvance}
        eliminated={pickAdvance && pred.advances === 'away'}
        scoreExact={isExactHit}
        pendingThird={match.homePendingThird}
        pendingThirdSlot={match.homePendingThirdSlot}
        voided={inicioKoVoid}
        advanceBadge={advanceSide === 'home'}
        onFilled={() => focusAwayInRow(slotRowRef.current)}
      />

      <BracketTeam
        name={match.away}
        crest={match.awayCrest}
        score={awaySlotScore}
        pred={pred.away}
        side="away"
        onScore={(side, v) => onScore?.(match.id, side, v)}
        onAdvance={() => onAdvance?.(match.id, 'away')}
        locked={matchLocked}
        readOnly={readOnly}
        pickable={!!pickAdvance}
        eliminated={pickAdvance && pred.advances === 'home'}
        scoreExact={isExactHit}
        pendingThird={match.awayPendingThird}
        pendingThirdSlot={match.awayPendingThirdSlot}
        voided={inicioKoVoid}
        advanceBadge={advanceSide === 'away'}
        onFilled={() => focusNextMatchHomeScore(slotRowRef.current)}
      />
      </div>

      {!readOnly && match.pendingThirdMatch && (
        <p className="bracket-slot-pending-hint">Tercero por confirmar — predicción bloqueada</p>
      )}

      {!readOnly
        && isFotmobCatalogMatchId(match.id)
        && (!apiRaw || isMatchNotStarted(apiRaw.status)) && (
        <MatchH2hInfo
          matchId={match.id}
          homeName={match.home}
          awayName={match.away}
          homeCrest={match.homeCrest}
          awayCrest={match.awayCrest}
          variant="bracket"
        />
      )}

      {readOnly && apiRaw?.status && (
        <MatchStatus status={apiRaw.status} highlight={apiRaw.status === 'IN_PLAY'} />
      )}

      {readOnly && userPred && (
        <div className="bracket-slot-pred">
          Tu porra: {userPred.home ?? '?'}–{userPred.away ?? '?'}
        </div>
      )}

    </div>
    </div>
  )
}
