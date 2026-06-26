'use client'

import { useEffect, useId, useRef, useState } from 'react'

import TeamCrest from '../TeamCrest'

/**
 * Burbuja verde (+N) sobre el marcador; al pulsar, tooltip con desglose de puntos.
 */
export default function MatchPointsBubble({
  points,
  detail,
  publishedResult,
  userPrediction = null,
  homeCrest,
  awayCrest,
  homeName = '',
  awayName = '',
  className = '',
  /** Marcador en vivo: estimación provisional, no definitiva */
  provisional = false,
  /** En ranking/porra ajena: destacar la predicción del usuario, no el resultado real */
  highlightPrediction = false,
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const tipId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (points == null || points < 0) return null
  if (points > 0 && !publishedResult) return null

  const isZero = points === 0
  const { home, away } = publishedResult || {}
  const realScoreLabel = `${homeName || 'Local'} ${home}–${away} ${awayName || 'Visitante'}`
  const hasUserPred = userPrediction?.home != null || userPrediction?.away != null
  const userPredLabel = hasUserPred
    ? `${userPrediction.home ?? '?'}–${userPrediction.away ?? '?'}`
    : null
  const showPredFirst = highlightPrediction && userPredLabel

  return (
    <div
      className={`match-points-bubble-wrap${isZero ? ' match-points-bubble-wrap--zero-void' : ''}${className ? ` ${className}` : ''}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className={`match-points-bubble${provisional ? ' match-points-bubble--provisional' : ''}${isZero ? ' match-points-bubble--zero' : ''}`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        aria-label={
          isZero
            ? '0 puntos. Pulsa para ver el motivo'
            : provisional
              ? `${points} puntos esperados (en vivo). Pulsa para ver el desglose`
              : `${points} puntos. Pulsa para ver el desglose`
        }
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        +{points}
      </button>
      {open && (
        <div id={tipId} className="match-points-tooltip" role="tooltip">
          {provisional && (
            <p className="match-points-tooltip-note">En vivo · estimado, puede cambiar</p>
          )}
          {showPredFirst ? (
            <>
              <div
                className="match-points-tooltip-score"
                aria-label={`Su porra: ${homeName || 'Local'} ${userPredLabel} ${awayName || 'Visitante'}`}
              >
                <TeamCrest src={homeCrest} alt={homeName} size={14} />
                <span className="match-points-tooltip-goals">{userPredLabel}</span>
                <TeamCrest src={awayCrest} alt={awayName} size={14} />
              </div>
              <p className="match-points-tooltip-real">
                Real: <strong>{home}–{away}</strong>
              </p>
            </>
          ) : publishedResult ? (
            <>
              {userPredLabel && (
                <p className="match-points-tooltip-pred">
                  Su porra: <strong>{userPredLabel}</strong>
                </p>
              )}
              <div
                className="match-points-tooltip-score"
                aria-label={
                  provisional ? `Marcador en vivo: ${realScoreLabel}` : `Resultado real: ${realScoreLabel}`
                }
              >
                <TeamCrest src={homeCrest} alt={homeName} size={14} />
                <span className="match-points-tooltip-goals">{home}–{away}</span>
                <TeamCrest src={awayCrest} alt={awayName} size={14} />
              </div>
            </>
          ) : userPredLabel ? (
            <div
              className="match-points-tooltip-score"
              aria-label={`Su porra: ${homeName || 'Local'} ${userPredLabel} ${awayName || 'Visitante'}`}
            >
              <TeamCrest src={homeCrest} alt={homeName} size={14} />
              <span className="match-points-tooltip-goals">{userPredLabel}</span>
              <TeamCrest src={awayCrest} alt={awayName} size={14} />
            </div>
          ) : null}
          {detail ? <p className="match-points-tooltip-detail">{detail}</p> : null}
        </div>
      )}
    </div>
  )
}
