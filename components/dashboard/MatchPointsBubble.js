'use client'

import { useEffect, useId, useRef, useState } from 'react'

import TeamCrest from '../TeamCrest'

/**
 * Burbuja verde (+N) sobre el marcador; al pulsar, tooltip con resultado real y desglose.
 */
export default function MatchPointsBubble({
  points,
  detail,
  publishedResult,
  homeCrest,
  awayCrest,
  homeName = '',
  awayName = '',
  className = '',
  /** Marcador en vivo: estimación provisional, no definitiva */
  provisional = false,
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

  if (!points || points <= 0 || !publishedResult) return null

  const { home, away } = publishedResult
  const scoreLabel = `${homeName || 'Local'} ${home}–${away} ${awayName || 'Visitante'}`

  return (
    <div
      className={`match-points-bubble-wrap${className ? ` ${className}` : ''}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className={`match-points-bubble${provisional ? ' match-points-bubble--provisional' : ''}`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        aria-label={
          provisional
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
          <div
            className="match-points-tooltip-score"
            aria-label={
              provisional ? `Marcador en vivo: ${scoreLabel}` : `Resultado real: ${scoreLabel}`
            }
          >
            <TeamCrest src={homeCrest} alt={homeName} size={14} />
            <span className="match-points-tooltip-goals">{home}–{away}</span>
            <TeamCrest src={awayCrest} alt={awayName} size={14} />
          </div>
          {detail ? <p className="match-points-tooltip-detail">{detail}</p> : null}
        </div>
      )}
    </div>
  )
}
