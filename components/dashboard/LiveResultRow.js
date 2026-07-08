'use client'

import TeamCrest from '../TeamCrest'
import { Icon, MatchStatus } from '../icons'
import FifaHighlightsButton from './FifaHighlightsButton'
import { formatMatchKickoff, formatMatchShortDate } from '../../lib/matchSchedule'
import { useSimulatedLiveClock } from '../../hooks/useSimulatedLiveClock'
import LiveClockLabel from './LiveClockLabel'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE'])
const UPCOMING_STATUSES = new Set(['SCHEDULED', 'TIMED'])

/** Cabecera minimalista en Porra: Local 1:0 Visitante · min · Vivo / FT (etiqueta a la derecha) */
export function PorraLiveHeader({
  home,
  away,
  score,
  status,
  liveTime,
  minute: matchMinute,
  onOpenDetail,
  apiRaw = null,
  homeLabel,
  awayLabel,
  /** Bracket: solo marcador (p. ej. 0:1), sin nombres ni badges */
  scoreOnly = false,
}) {
  const isFinished = status === 'FINISHED'
  const isLive = LIVE_STATUSES.has(status)
  const isStatusPaused = status === 'PAUSED'
  const hasScore = score?.home != null && score?.away != null
  const showStrip = (isLive || isFinished || isStatusPaused) && hasScore

  const liveClock = useSimulatedLiveClock({
    liveTime,
    minute: matchMinute,
    status,
    enabled: showStrip && (isLive || isStatusPaused),
  })

  if (!showStrip) return null

  const minute = liveClock?.compact || null
  const isPaused = isStatusPaused || minute === 'HT'
  const label = isFinished ? 'FT' : isPaused ? 'Descanso' : 'Vivo'
  const stripClass = [
    'porra-live-strip',
    scoreOnly ? 'porra-live-strip--score-only' : '',
    onOpenDetail ? 'porra-live-strip--clickable' : '',
    isFinished ? 'porra-live-strip--finished' : '',
    isLive && !isPaused ? 'porra-live-strip--live' : '',
  ].filter(Boolean).join(' ')

  const inner = scoreOnly ? (
    <>
      <span className="porra-live-strip__score">{score.home}:{score.away}</span>
      {!isFinished && minute ? (
        <span className="porra-live-strip__minute">{minute}</span>
      ) : null}
    </>
  ) : (
    <>
      <span className="porra-live-strip__match">
        <span className="porra-live-strip__team">{home}</span>
        <span className="porra-live-strip__score">{score.home}:{score.away}</span>
        <span className="porra-live-strip__team">{away}</span>
        {minute && <span className="porra-live-strip__minute">{minute}</span>}
      </span>
      <span className="porra-live-strip__actions">
        <span className={`porra-live-strip__badge${isFinished ? ' porra-live-strip__badge--ft' : ''}`}>
          {!isFinished && (
            isPaused ? (
              <Icon name="pauseCircle" size={11} />
            ) : (
              <Icon name="signal" size={11} className="live-score-block__live-icon" />
            )
          )}
          <span>{label}</span>
        </span>
        {isFinished && (
          <FifaHighlightsButton
            apiRaw={apiRaw}
            homeLabel={homeLabel ?? home}
            awayLabel={awayLabel ?? away}
            compact
            className="fifa-highlights-btn--strip"
          />
        )}
        {onOpenDetail && (
          <Icon name="chevronRight" size={11} className="porra-live-strip__chevron" aria-hidden />
        )}
      </span>
    </>
  )

  if (onOpenDetail) {
    return (
      <button
        type="button"
        className={stripClass}
        onClick={onOpenDetail}
        aria-label={
          isFinished
            ? `Ver partido: ${home} ${score.home}:${score.away} ${away} · FT`
            : `Abrir directo: ${home} ${score.home}:${score.away} ${away} · ${label}`
        }
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={stripClass} role="status">
      {inner}
    </div>
  )
}

export function LiveScoreBlock({ score, status, liveTime, minute: matchMinute, size = 'row' }) {
  const isLive = LIVE_STATUSES.has(status)
  const liveClock = useSimulatedLiveClock({
    liveTime,
    minute: matchMinute,
    status,
    enabled: isLive,
  })
  if (!isLive || score?.home == null || score?.away == null) return null

  const minute = liveClock?.compact || null
  const isPaused = status === 'PAUSED' || minute === 'HT'
  const blockClass = [
    'live-score-block',
    size === 'detail' ? 'live-score-block--detail' : '',
    isPaused ? 'live-score-block--pause' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={blockClass}>
      <div className={`live-score-block__badge${isPaused ? ' live-score-block__badge--pause' : ''}`}>
        {isPaused ? (
          <Icon name="pauseCircle" size="sm" />
        ) : (
          <Icon name="signal" size="sm" className="live-score-block__live-icon" />
        )}
        <span className="live-score-block__label">{isPaused ? 'Descanso' : 'En juego'}</span>
      </div>
      <div
        className="live-score-block__score"
        aria-label={`Resultado ${score.home} a ${score.away}`}
      >
        <span className="live-score-block__num">{score.home}</span>
        <span className="live-score-block__sep" aria-hidden="true">-</span>
        <span className="live-score-block__num">{score.away}</span>
      </div>
      {minute && (
        <span className="live-score-block__minute">{minute}</span>
      )}
    </div>
  )
}

export default function LiveResultRow({
  home,
  away,
  homeCrest,
  awayCrest,
  utcDate,
  score,
  status,
  liveTime,
  minute: matchMinute,
  userPred,
  compact = false,
  denseTable = false,
  onGoToPrediction,
  onOpenDetail,
  matchRef,
  showMatchDate = false,
  apiRaw = null,
}) {
  const isLive = LIVE_STATUSES.has(status)
  const isFinished = status === 'FINISHED'
  const isUpcoming = UPCOMING_STATUSES.has(status)
  const liveClock = useSimulatedLiveClock({
    liveTime,
    minute: matchMinute,
    status,
    enabled: isLive || status === 'PAUSED',
  })
  const displayMinute = liveClock?.compact || null
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
  const crestSize = denseTable ? 16 : compact ? 22 : 28

  const hasFooter = userPred || onGoToPrediction
  const clickable = typeof onOpenDetail === 'function'

  const rowClass = [
    'schedule-match-row',
    compact ? 'schedule-match-row--compact' : '',
    denseTable ? 'schedule-match-row--dense-table' : '',
    isLive ? 'schedule-match-row--live' : '',
    clickable ? 'schedule-match-row--clickable' : '',
  ].filter(Boolean).join(' ')

  if (denseTable) {
    const scoreLabel = hasScore
      ? `${score.home} - ${score.away}`
      : '– : –'
    const rowInnerDense = (
      <>
        <div className="schedule-match-team schedule-match-team--home">
          <TeamCrest src={homeCrest} alt={home} size={crestSize} />
          <span className="schedule-match-team-name">{home}</span>
        </div>
        <div className="schedule-match-center">
          <span className="schedule-match-center-actions">
            <span className="schedule-match-scoreline" aria-label={`Resultado ${scoreLabel}`}>
              {hasScore ? (
                <>
                  <span>{score.home}</span>
                  <span className="schedule-match-score-sep" aria-hidden>:</span>
                  <span>{score.away}</span>
                </>
              ) : (
                <span className="schedule-match-scoreline--pending">–</span>
              )}
            </span>
            {isLive && hasScore && (
              <LiveClockLabel
                liveTime={liveTime}
                minute={matchMinute}
                status={status}
                className="schedule-match-live-clock"
              />
            )}
            {isLive && hasScore && (
              <span className="schedule-match-live-dot" aria-hidden={!!displayMinute} aria-label={displayMinute ? undefined : 'En juego'} />
            )}
            {isFinished && (
              <FifaHighlightsButton
                apiRaw={apiRaw}
                homeLabel={home}
                awayLabel={away}
                compact
                className="fifa-highlights-btn--strip"
              />
            )}
            {clickable && isFinished && (
              <Icon name="chevronRight" size={11} className="match-status-label__chevron" aria-hidden />
            )}
          </span>
        </div>
        <div className="schedule-match-team schedule-match-team--away">
          <TeamCrest src={awayCrest} alt={away} size={crestSize} />
          <span className="schedule-match-team-name">{away}</span>
        </div>
      </>
    )

    return (
      <div className="schedule-match-row-wrap schedule-match-row-wrap--dense" ref={matchRef}>
        {clickable ? (
          <button
            type="button"
            className={rowClass}
            onClick={onOpenDetail}
            aria-label={`Ver detalle: ${home} contra ${away}`}
          >
            {rowInnerDense}
          </button>
        ) : (
          <div className={rowClass}>{rowInnerDense}</div>
        )}
        {userPred && (
          <div className="schedule-match-dense-pred">
            Tu porra: {userPred.home ?? '?'}-{userPred.away ?? '?'}
          </div>
        )}
      </div>
    )
  }

  const rowClassDefault = [
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
      <div className={`schedule-match-center${isLive && hasScore ? ' schedule-match-center--live' : ''}`}>
        {isLive && hasScore ? (
          <LiveScoreBlock score={score} status={status} liveTime={liveTime} minute={matchMinute} />
        ) : hasScore ? (
          <>
            <div className="schedule-match-result">
              <span className="schedule-match-result-score">{score.home} - {score.away}</span>
            </div>
            {!isFinished && renderKickoff()}
            {status && (
              <span className="match-status-label-row">
                <MatchStatus
                  status={status}
                  highlight={false}
                  upcoming={isUpcoming}
                  withChevron={false}
                />
                {isFinished && (
                  <FifaHighlightsButton
                    apiRaw={apiRaw}
                    homeLabel={home}
                    awayLabel={away}
                    compact
                    className="fifa-highlights-btn--strip"
                  />
                )}
                {clickable && isFinished && (
                  <Icon name="chevronRight" size={11} className="match-status-label__chevron" aria-hidden />
                )}
              </span>
            )}
          </>
        ) : (
          <>
            {showMatchDate ? renderKickoff() : <span className="schedule-match-time">{kickoff}</span>}
            {status && (
              <MatchStatus status={status} highlight={isLive} upcoming={isUpcoming} />
            )}
          </>
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
          className={rowClassDefault}
          onClick={onOpenDetail}
          aria-label={`Ver detalle: ${home} contra ${away}`}
        >
          {rowInner}
        </button>
      ) : (
        <div className={rowClassDefault}>{rowInner}</div>
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
