'use client'

import { useMemo, useRef } from 'react'

import TeamCrest from '../TeamCrest'
import { summarizeMatchPoints, isInicioKoId } from '../../lib/matchPointsDisplay'
import { isExactScoreHit } from '../../lib/gameData'
import {
  getInicioKnockoutUiStatus,
  summarizeInicioKnockoutMatchPoints,
} from '../../lib/inicioKnockoutScoring'
import MatchPointsBubble from './MatchPointsBubble'

import { formatMatchKickoff, formatMatchShortDate } from '../../lib/matchSchedule'

import { focusAwayInRow, focusNextMatchHomeScore } from '../../lib/scheduleScoreFocus'

import ScoreInput from './ScoreInput'

import { needsKnockoutAdvancePick, resolveKnockoutAdvanceSide } from '../../lib/knockoutAdvances'
import { getApiMatchDisplayScore } from '../../lib/apiMatchScores'
import { isLiveMatchStatus, isPorraApiResultStatus } from '../../lib/matchDetail'
import { isFotmobCatalogMatchId, isMatchNotStarted } from '../../lib/matchHeadToHead'
import { PorraLiveHeader } from './LiveResultRow'
import MatchPredsInfo from './MatchPredsInfo'
import MatchH2hInfo from './MatchH2hInfo'
import { getParticipantPredsForMatch } from '../../lib/participantMatchPreds'



function TeamBlock({

  side,

  name,

  crest,

  crestSize,

  pickable,

  eliminated,

  onPick,

  locked,

  pendingThird = false,

  pendingThirdSlot = null,

  voided = false,

  advanceBadge = false,

}) {

  const className = [

    'schedule-match-team',

    `schedule-match-team--${side}`,

    pickable ? 'schedule-match-team--pick' : '',

    eliminated ? 'schedule-match-team--out' : '',

    voided ? 'schedule-match-team--void' : '',

    pendingThird ? 'schedule-match-team--pending-third' : '',

    advanceBadge ? 'schedule-match-team--advances' : '',

  ].filter(Boolean).join(' ')



  const inner = (

    <>

      {pendingThird ? (
        <span
          className="schedule-pending-third-dot"
          title={pendingThirdSlot ? `Mejor tercero: ${pendingThirdSlot}` : 'Mejor tercero por confirmar'}
          aria-label="Tercero por confirmar"
        />
      ) : (
        <TeamCrest src={crest} alt={name} size={crestSize} />
      )}

      <span className="schedule-match-team-name" title={pendingThirdSlot || name}>
        {name}
        {advanceBadge && crest ? (
          <span className="schedule-match-advance-crest" title="Pasa de ronda" aria-hidden>
            <TeamCrest src={crest} alt="" size={Math.max(12, crestSize - 12)} />
          </span>
        ) : null}
      </span>

    </>

  )



  if (!pickable) {

    return <div className={className}>{inner}</div>

  }



  return (

    <button

      type="button"

      className={className}

      disabled={locked}

      aria-pressed={!eliminated}

      aria-label={eliminated ? `${name} eliminado` : `${name} pasa de ronda`}

      onClick={() => onPick(side)}

    >

      {inner}

    </button>

  )

}



export default function MatchRow({

  home,

  away,

  homeCrest,

  awayCrest,

  utcDate,

  matchNumber,

  fifaMatchLabel,

  knockoutMatchupLabel,

  homeVal,

  awayVal,

  onHome,

  onAway,

  locked,

  matchRef,

  readOnly = false,

  /** Porra ajena (ranking): el tooltip de puntos muestra su predicción */
  viewingParticipantPreds = false,

  compact = false,

  denseTable = false,

  showMatchDate = false,

  advancesVal,

  onAdvance,

  knockoutAdvance = false,

  /** Resultado publicado (organizador / fixture de prueba). */
  publishedResult = null,

  /** { predictedTeams, actualTeams } para puntuar eliminatorias */
  knockoutScoringTeams = null,

  /** Partido crudo de la API (marcador y estado en vivo). */
  apiRaw = null,

  /** Abre el detalle en vivo del partido. */
  onOpenLiveDetail,

  /** Mapa de participantes del grupo (para tooltip de porras). */
  participants = null,

  matchId = null,

  groupMatches = [],

  knockoutMatches = [],

  homePendingThird = false,

  awayPendingThird = false,

  pendingThirdMatch = false,

  homePendingThirdSlot = null,

  awayPendingThirdSlot = null,

  /** Estado de puntuación KO previsto (Inicio ×0,6) */
  inicioKnockoutScoring = null,

}) {

  const rowRef = useRef(null)

  const kickoff = formatMatchKickoff(utcDate)

  const matchDate = formatMatchShortDate(utcDate)

  const crestSize = denseTable ? 14 : compact ? 22 : 28
  const showDenseScores = denseTable && locked

  const matchTag = fifaMatchLabel || (matchNumber != null ? `Partido ${matchNumber}` : null)

  const slotLine = knockoutMatchupLabel || null

  const predRow = {

    home: homeVal === '' ? null : Number(homeVal),

    away: awayVal === '' ? null : Number(awayVal),

    advances: advancesVal,

  }

  const pickAdvance =

    knockoutAdvance && !readOnly && needsKnockoutAdvancePick(predRow) && onAdvance

  const advanceSide = useMemo(() => {
    if (!knockoutAdvance) return null
    return resolveKnockoutAdvanceSide(predRow)
  }, [knockoutAdvance, predRow])

  const isInicioKo = isInicioKoId(matchId)

  const inicioKoUiStatus = useMemo(() => {
    if (!isInicioKo || !inicioKnockoutScoring) return null
    return getInicioKnockoutUiStatus(home, away, matchNumber, inicioKnockoutScoring)
  }, [isInicioKo, inicioKnockoutScoring, home, away, matchNumber])

  const inicioKoVoid = inicioKoUiStatus?.void === true

  const scoringOpts = useMemo(
    () => ({
      knockout: knockoutAdvance,
      predictedTeams: knockoutScoringTeams?.predictedTeams,
      actualTeams: knockoutScoringTeams?.actualTeams,
    }),
    [knockoutAdvance, knockoutScoringTeams],
  )

  const pointsSummary = useMemo(() => {
    if (isInicioKo && inicioKnockoutScoring) {
      return summarizeInicioKnockoutMatchPoints(
        predRow,
        { home, away },
        inicioKnockoutScoring,
        matchNumber,
      )
    }
    if (!publishedResult) return null
    return summarizeMatchPoints(predRow, publishedResult, scoringOpts)
  }, [isInicioKo, inicioKnockoutScoring, publishedResult, homeVal, awayVal, advancesVal, home, away, scoringOpts, predRow])

  const apiScore = apiRaw ? getApiMatchDisplayScore(apiRaw) : null
  const isApiLive = apiRaw && isLiveMatchStatus(apiRaw.status)
  const isApiFinished = apiRaw?.status === 'FINISHED'
  const showPorraHeader = !readOnly && apiRaw && apiScore && isPorraApiResultStatus(apiRaw.status)

  const livePointsSummary = useMemo(() => {
    if (isInicioKo && inicioKnockoutScoring) {
      if (!isApiLive || !apiScore || publishedResult) return null
      return summarizeInicioKnockoutMatchPoints(predRow, { home, away }, inicioKnockoutScoring, matchNumber)
    }
    if (!isApiLive || !apiScore || publishedResult) return null
    return summarizeMatchPoints(predRow, apiScore, scoringOpts)
  }, [isInicioKo, inicioKnockoutScoring, isApiLive, apiScore, publishedResult, homeVal, awayVal, advancesVal, home, away, scoringOpts, predRow])

  const apiFinishedPointsSummary = useMemo(() => {
    if (isInicioKo && inicioKnockoutScoring) {
      if (!isApiFinished || !apiScore || publishedResult) return null
      return summarizeInicioKnockoutMatchPoints(predRow, { home, away }, inicioKnockoutScoring, matchNumber)
    }
    if (!isApiFinished || !apiScore || publishedResult) return null
    return summarizeMatchPoints(predRow, apiScore, scoringOpts)
  }, [isInicioKo, inicioKnockoutScoring, isApiFinished, apiScore, publishedResult, homeVal, awayVal, advancesVal, home, away, scoringOpts, predRow])

  const resultForCompare = publishedResult || apiScore || null
  const isExactHit = useMemo(() => {
    if (inicioKoVoid) return false
    if (isInicioKo && inicioKnockoutScoring) {
      const s = summarizeInicioKnockoutMatchPoints(
        predRow,
        { home, away },
        inicioKnockoutScoring,
        matchNumber,
      )
      return (s?.split?.resultado ?? 0) > 0
    }
    return isExactScoreHit(predRow, resultForCompare, scoringOpts)
  }, [inicioKoVoid, isInicioKo, inicioKnockoutScoring, predRow, home, away, resultForCompare, scoringOpts])

  const participantPredRows = useMemo(() => {
    if (readOnly || !participants || !matchId) return []
    return getParticipantPredsForMatch(participants, matchId, {
      groupMatches,
      knockoutMatches,
      match: { home, away, homeCrest, awayCrest },
    })
  }, [readOnly, participants, matchId, groupMatches, knockoutMatches, home, away, homeCrest, awayCrest])

  function setRowRef(el) {

    rowRef.current = el

    if (matchRef) matchRef(el)

  }

  const bubbleUserPred = (readOnly || viewingParticipantPreds) ? predRow : null
  const bubbleProps = {
    userPrediction: bubbleUserPred,
    highlightPrediction: viewingParticipantPreds,
    homeCrest,
    awayCrest,
    homeName: home,
    awayName: away,
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
    if (publishedResult && pointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={pointsSummary.pts}
          detail={pointsSummary.detail}
          publishedResult={publishedResult}
          {...bubbleProps}
        />
      )
    }
    if (isApiLive && livePointsSummary?.pts > 0) {
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
    if (isApiFinished && apiFinishedPointsSummary?.pts > 0) {
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

  const pointsBubble = voidZeroBubble || inlinePointsBubble

  const wrapClass = [
    'schedule-match-wrap',
    isApiLive ? 'schedule-match-wrap--live' : '',
    isApiFinished ? 'schedule-match-wrap--finished' : '',
  ].filter(Boolean).join(' ')

  const rowStateClass = [
    isApiLive ? ' schedule-match-row--live' : isApiFinished ? ' schedule-match-row--finished' : '',
    inicioKoVoid ? ' schedule-match-row--void' : '',
  ].filter(Boolean).join('')

  const showHeadToHeadBtn =
    isFotmobCatalogMatchId(matchId)
    && (!apiRaw || isMatchNotStarted(apiRaw.status))
    && !readOnly

  return (

    <div className={wrapClass}>
    {showPorraHeader && (
      <PorraLiveHeader
        home={home}
        away={away}
        score={apiScore}
        status={apiRaw.status}
        liveTime={apiRaw.liveTime}
        minute={apiRaw.minute}
        onOpenDetail={onOpenLiveDetail}
        apiRaw={isApiFinished ? apiRaw : null}
        homeLabel={home}
        awayLabel={away}
      />
    )}
    <div

      className={`schedule-match-row${compact ? ' schedule-match-row--compact' : ''}${denseTable ? ' schedule-match-row--dense-table' : ''}${pickAdvance ? ' schedule-match-row--pick-advance' : ''}${rowStateClass}`}

      ref={setRowRef}

    >

      <TeamBlock

        side="home"

        name={home}

        crest={homeCrest}

        crestSize={crestSize}

        pickable={!!pickAdvance}

        eliminated={pickAdvance && advancesVal === 'away'}

        onPick={onAdvance}

        locked={locked}

        pendingThird={homePendingThird}

        pendingThirdSlot={homePendingThirdSlot}

        voided={inicioKoVoid}

        advanceBadge={advanceSide === 'home'}

      />

      <div
        className={`schedule-match-center${knockoutAdvance && !readOnly ? ' schedule-match-center--knockout' : ''}`}
      >

        {matchTag && !denseTable ? (

          <span className="schedule-match-tag-row">

            <span className="schedule-match-number" title={slotLine ? `${matchTag} · ${slotLine}` : matchTag}>

              {matchTag}

            </span>

            <span className="schedule-match-tag-icons">
              {!readOnly && participantPredRows.length > 0 && (
                <MatchPredsInfo rows={participantPredRows} />
              )}
            </span>

          </span>

        ) : null}

        {slotLine && !denseTable ? (

          <span className="schedule-match-slots">{slotLine}</span>

        ) : null}

        {readOnly ? (

          <span className="schedule-match-time">{kickoff}</span>

        ) : showDenseScores ? (

          <span className={`schedule-match-scores-wrap${pointsBubble ? ' schedule-match-scores-wrap--has-bubble' : ''}`}>
            {pointsBubble}
            <span
              className={`schedule-match-scoreline${isExactHit ? ' schedule-match-scoreline--exact' : ''}`}
              aria-label={`${home} ${homeVal === '' ? 'sin marcar' : homeVal}, ${away} ${awayVal === '' ? 'sin marcar' : awayVal}${isExactHit ? ' · marcador exacto' : ''}`}
            >
              <span>{homeVal === '' ? '–' : homeVal}</span>
              <span className="schedule-match-score-sep" aria-hidden>:</span>
              <span>{awayVal === '' ? '–' : awayVal}</span>
            </span>
          </span>

        ) : (

          <>

            <div className={`schedule-match-scores-wrap${pointsBubble ? ' schedule-match-scores-wrap--has-bubble' : ''}`}>
            {pointsBubble}
            <div className={`schedule-match-scores${isExactHit ? ' schedule-match-scores--exact' : ''}`}>

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
            </div>

            {!showPorraHeader && showMatchDate ? (

              <span className="schedule-match-datetime">

                <span className="schedule-match-date">{matchDate}</span>

                <span className="schedule-match-kickoff">{kickoff}</span>

              </span>

            ) : !showPorraHeader ? (

              <span className="schedule-match-kickoff">{kickoff}</span>

            ) : null}

            {showHeadToHeadBtn && (
              <MatchH2hInfo
                matchId={matchId}
                homeName={home}
                awayName={away}
                homeCrest={homeCrest}
                awayCrest={awayCrest}
              />
            )}

            {knockoutAdvance && !readOnly ? (
              <p
                className={`schedule-match-advance-hint${pickAdvance ? ' schedule-match-advance-hint--visible' : ''}`}
                role={pickAdvance ? 'status' : undefined}
                aria-hidden={!pickAdvance}
              >
                Toca el equipo que pasa
              </p>
            ) : null}

          </>

        )}

      </div>

      <TeamBlock

        side="away"

        name={away}

        crest={awayCrest}

        crestSize={crestSize}

        pickable={!!pickAdvance}

        eliminated={pickAdvance && advancesVal === 'home'}

        onPick={onAdvance}

        locked={locked}

        pendingThird={awayPendingThird}

        pendingThirdSlot={awayPendingThirdSlot}

        voided={inicioKoVoid}

        advanceBadge={advanceSide === 'away'}

      />

    </div>

    {pendingThirdMatch && !readOnly && (
      <p className="schedule-match-pending-third-hint">Tercero por confirmar — predicción bloqueada</p>
    )}

    </div>

  )

}


