'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import TeamCrest from '../TeamCrest'
import { formatMadridShortDateTime } from '../../lib/madridTime'

function findListPlacement(wrapEl) {
  const listRoot =
    wrapEl?.closest('.schedule-full-list')
    || wrapEl?.closest('.schedule-block-list')
    || wrapEl?.closest('.schedule-matches-panel')
  if (!listRoot || !wrapEl) return 'above'

  const rowList = listRoot.querySelectorAll('.schedule-match-wrap')
  if (!rowList.length) return 'above'

  let idx = -1
  rowList.forEach((row, i) => {
    if (row.contains(wrapEl)) idx = i
  })
  if (idx < 0) return 'above'

  const total = rowList.length
  const edge = Math.max(2, Math.ceil(total * 0.15))
  if (idx < edge) return 'below'
  if (idx >= total - edge) return 'above'
  return 'above'
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Icono «i» con tooltip minimalista: predicciones de todos los participantes en el partido.
 */
export default function MatchPredsInfo({ rows = [], resultUpdatedAt = null, className = '' }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('above')
  const [tipStyle, setTipStyle] = useState(null)
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef(null)
  const tipRef = useRef(null)
  const tipId = useId()

  useEffect(() => setMounted(true), [])

  const reposition = useCallback(() => {
    const wrap = wrapRef.current
    const tip = tipRef.current
    if (!wrap || !tip) return

    const btn = wrap.querySelector('.match-preds-info-btn')
    if (!btn) return

    let place = findListPlacement(wrap)
    const btnRect = btn.getBoundingClientRect()
    const tipRect = tip.getBoundingClientRect()
    const margin = 6
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top =
      place === 'below'
        ? btnRect.bottom + margin
        : btnRect.top - tipRect.height - margin

    if (place === 'below' && top + tipRect.height > vh - 8) {
      place = 'above'
      top = btnRect.top - tipRect.height - margin
    } else if (place === 'above' && top < 8) {
      place = 'below'
      top = btnRect.bottom + margin
    }

    const left = clamp(
      btnRect.left + btnRect.width / 2 - tipRect.width / 2,
      8,
      vw - tipRect.width - 8,
    )

    setPlacement(place)
    setTipStyle({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setTipStyle(null)
      return
    }
    reposition()
  }, [open, reposition, rows.length])

  useEffect(() => {
    if (!open) return
    function onReposition() {
      reposition()
    }
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      const target = e.target
      if (wrapRef.current?.contains(target)) return
      if (tipRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!rows.length) return null

  const tooltip =
    open && mounted
      ? createPortal(
        <div
          id={tipId}
          ref={tipRef}
          className={[
            'match-preds-info-tooltip',
            'match-preds-info-tooltip--fixed',
            `match-preds-info-tooltip--${placement}`,
            tipStyle ? '' : 'match-preds-info-tooltip--measuring',
          ].filter(Boolean).join(' ')}
          style={
            tipStyle
              ? { top: tipStyle.top, left: tipStyle.left }
              : undefined
          }
          role="tooltip"
        >
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
          {resultUpdatedAt && (
            <p className="match-preds-info-tooltip-updated">
              Resultado actualizado: {formatMadridShortDateTime(resultUpdatedAt)}
            </p>
          )}
        </div>,
        document.body,
      )
      : null

  return (
    <>
      <div
        className={[
          'match-preds-info-wrap',
          open ? 'match-preds-info-wrap--open' : '',
          className,
        ].filter(Boolean).join(' ')}
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
      </div>
      {tooltip}
    </>
  )
}
