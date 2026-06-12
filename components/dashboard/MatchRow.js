'use client'

import { useMemo, useRef } from 'react'

import TeamCrest from '../TeamCrest'
import { summarizeMatchPoints } from '../../lib/matchPointsDisplay'
import MatchPointsBubble from './MatchPointsBubble'

import { formatMatchKickoff, formatMatchShortDate } from '../../lib/matchSchedule'

import { focusAwayInRow, focusNextMatchHomeScore } from '../../lib/scheduleScoreFocus'

import ScoreInput from './ScoreInput'

import { needsKnockoutAdvancePick } from '../../lib/knockoutAdvances'
import { getApiMatchDisplayScore } from '../../lib/apiMatchScores'
import { isLiveMatchStatus, isPorraApiResultStatus } from '../../lib/matchDetail'
import { PorraLiveHeader } from './LiveResultRow'



function TeamBlock({

  side,

  name,

  crest,

  crestSize,

  pickable,

  eliminated,

  onPick,

  locked,

}) {

  const className = [

    'schedule-match-team',

    `schedule-match-team--${side}`,

    pickable ? 'schedule-match-team--pick' : '',

    eliminated ? 'schedule-match-team--out' : '',

  ].filter(Boolean).join(' ')



  const inner = (

    <>

      <TeamCrest src={crest} alt={name} size={crestSize} />

      <span className="schedule-match-team-name">{name}</span>

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

  const scoringOpts = useMemo(
    () => ({
      knockout: knockoutAdvance,
      predictedTeams: knockoutScoringTeams?.predictedTeams,
      actualTeams: knockoutScoringTeams?.actualTeams,
    }),
    [knockoutAdvance, knockoutScoringTeams],
  )

  const pointsSummary = useMemo(() => {
    if (!publishedResult) return null
    return summarizeMatchPoints(predRow, publishedResult, scoringOpts)
  }, [publishedResult, homeVal, awayVal, advancesVal, scoringOpts])

  const apiScore = apiRaw ? getApiMatchDisplayScore(apiRaw) : null
  const isApiLive = apiRaw && isLiveMatchStatus(apiRaw.status)
  const isApiFinished = apiRaw?.status === 'FINISHED'
  const showPorraHeader = !readOnly && apiRaw && apiScore && isPorraApiResultStatus(apiRaw.status)

  const livePointsSummary = useMemo(() => {
    if (!isApiLive || !apiScore || publishedResult) return null
    return summarizeMatchPoints(predRow, apiScore, scoringOpts)
  }, [isApiLive, apiScore, publishedResult, homeVal, awayVal, advancesVal, scoringOpts])

  const apiFinishedPointsSummary = useMemo(() => {
    if (!isApiFinished || !apiScore || publishedResult) return null
    return summarizeMatchPoints(predRow, apiScore, scoringOpts)
  }, [isApiFinished, apiScore, publishedResult, homeVal, awayVal, advancesVal, scoringOpts])

  function setRowRef(el) {

    rowRef.current = el

    if (matchRef) matchRef(el)

  }

  const pointsBubble = (() => {
    if (publishedResult && pointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={pointsSummary.pts}
          detail={pointsSummary.detail}
          publishedResult={publishedResult}
          homeCrest={homeCrest}
          awayCrest={awayCrest}
          homeName={home}
          awayName={away}
        />
      )
    }
    if (isApiLive && livePointsSummary?.pts > 0) {
      return (
        <MatchPointsBubble
          points={livePointsSummary.pts}
          detail={livePointsSummary.detail}
          publishedResult={apiScore}
          homeCrest={homeCrest}
          awayCrest={awayCrest}
          homeName={home}
          awayName={away}
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
          homeCrest={homeCrest}
          awayCrest={awayCrest}
          homeName={home}
          awayName={away}
        />
      )
    }
    return null
  })()

  const wrapClass = [
    'schedule-match-wrap',
    isApiLive ? 'schedule-match-wrap--live' : '',
    isApiFinished ? 'schedule-match-wrap--finished' : '',
  ].filter(Boolean).join(' ')

  const rowStateClass = isApiLive ? ' schedule-match-row--live' : isApiFinished ? ' schedule-match-row--finished' : ''

  return (

    <div className={wrapClass}>
    {showPorraHeader && (
      <PorraLiveHeader
        home={home}
        away={away}
        score={apiScore}
        status={apiRaw.status}
        liveMinute={apiRaw.liveTime?.short || (apiRaw.minute != null ? `${apiRaw.minute}'` : null)}
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

      />

      <div
        className={`schedule-match-center${knockoutAdvance && !readOnly ? ' schedule-match-center--knockout' : ''}`}
      >

        {matchTag && !denseTable ? (

          <span className="schedule-match-number" title={slotLine ? `${matchTag} · ${slotLine}` : matchTag}>

            {matchTag}

          </span>

        ) : null}

        {slotLine && !denseTable ? (

          <span className="schedule-match-slots">{slotLine}</span>

        ) : null}

        {readOnly ? (

          <span className="schedule-match-time">{kickoff}</span>

        ) : showDenseScores ? (

          <span className="schedule-match-scores-wrap">
            {pointsBubble}
            <span
              className="schedule-match-scoreline"
              aria-label={`${home} ${homeVal === '' ? 'sin marcar' : homeVal}, ${away} ${awayVal === '' ? 'sin marcar' : awayVal}`}
            >
              <span>{homeVal === '' ? '–' : homeVal}</span>
              <span className="schedule-match-score-sep" aria-hidden>:</span>
              <span>{awayVal === '' ? '–' : awayVal}</span>
            </span>
          </span>

        ) : (

          <>

            <div className="schedule-match-scores-wrap">
            {pointsBubble}
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
            </div>

            {!showPorraHeader && showMatchDate ? (

              <span className="schedule-match-datetime">

                <span className="schedule-match-date">{matchDate}</span>

                <span className="schedule-match-kickoff">{kickoff}</span>

              </span>

            ) : !showPorraHeader ? (

              <span className="schedule-match-kickoff">{kickoff}</span>

            ) : null}

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

      />

    </div>

    </div>

  )

}


