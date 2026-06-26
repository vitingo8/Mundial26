'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../icons'
import TeamCrest from '../TeamCrest'

/**
 * Icono «i» con tooltip minimalista: predicciones de todos los participantes en el partido.
 */
export default function MatchPredsInfo({ rows = [], className = '' }) {
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

  if (!rows.length) return null

  return (
    <div
      className={`match-preds-info-wrap${className ? ` ${className}` : ''}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className="match-preds-info-btn"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        aria-label={`Ver ${rows.length} predicciones en este partido`}
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        <Icon name="informationCircle" size={13} />
      </button>
      {open && (
        <div id={tipId} className="match-preds-info-tooltip" role="tooltip">
          <p className="match-preds-info-tooltip-title">Porras del grupo</p>
          <ul className="match-preds-info-list">
            {rows.map(row => (
              <li key={row.id} className="match-preds-info-row">
                <span className="match-preds-info-name">{row.label}</span>
                <span className="match-preds-info-score">
                  {row.home ?? '?'}–{row.away ?? '?'}
                  {row.advanceCrest ? (
                    <span
                      className="match-preds-info-advance-crest"
                      title={row.advanceName ? `Pasa: ${row.advanceName}` : 'Pasa de ronda'}
                    >
                      <TeamCrest src={row.advanceCrest} alt={row.advanceName || ''} size={14} />
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
