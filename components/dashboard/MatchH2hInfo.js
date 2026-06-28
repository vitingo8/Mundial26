'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TeamCrest from '../TeamCrest'
import { fetchWcMatchClient } from '../../lib/footballData'
import { loadMatchH2hPreview, peekMatchH2h } from '../../lib/h2hPreviewCache'
import { isWorldCupH2hCompetition } from '../../lib/matchHeadToHead'

function findListPlacement(wrapEl) {
  const listRoot =
    wrapEl?.closest('.schedule-full-list')
    || wrapEl?.closest('.schedule-block-list')
    || wrapEl?.closest('.schedule-matches-panel')
    || wrapEl?.closest('.bracket-slot-shell')
  if (!listRoot || !wrapEl) return 'above'

  const rowList = listRoot.querySelectorAll('.schedule-match-wrap, .bracket-slot-shell')
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

function shortH2hDate(utcDate) {
  if (!utcDate) return '—'
  return new Date(utcDate).toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function winnerCrest(row) {
  const { home, away } = row.score || {}
  if (home == null || away == null) return null
  if (home > away) return row.home?.crest || null
  if (away > home) return row.away?.crest || null
  return null
}

/**
 * Etiqueta «Cara a Cara» con tooltip de historial. No se renderiza si no hay H2H.
 */
export default function MatchH2hInfo({
  matchId,
  homeName,
  awayName,
  homeCrest,
  awayCrest,
  variant = 'default',
  className = '',
}) {
  const cached = peekMatchH2h(matchId)
  const [headToHead, setHeadToHead] = useState(cached ?? null)
  const [ready, setReady] = useState(cached !== undefined)
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('above')
  const [tipStyle, setTipStyle] = useState(null)
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef(null)
  const tipRef = useRef(null)
  const tipId = useId()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!matchId) {
      setReady(true)
      return
    }
    let cancelled = false
    loadMatchH2hPreview(matchId, () => fetchWcMatchClient(matchId, { force: false }))
      .then(h2h => {
        if (cancelled) return
        setHeadToHead(h2h)
        setReady(true)
      })
    return () => { cancelled = true }
  }, [matchId])

  const reposition = useCallback(() => {
    const wrap = wrapRef.current
    const tip = tipRef.current
    if (!wrap || !tip) return

    const btn = wrap.querySelector('.schedule-match-h2h-btn')
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

    if (top + tipRect.height > vh - 8) {
      top = Math.max(8, vh - tipRect.height - 8)
    }
    if (top < 8) top = 8

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
  }, [open, reposition, headToHead])

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

  if (!ready || !headToHead?.matches?.length) return null

  const isBracket = variant === 'bracket'
  const hasWorldCup = headToHead.matches.some(row =>
    isWorldCupH2hCompetition(row.competitionRaw || row.competition),
  )

  const tooltip =
    open && mounted
      ? createPortal(
        <div
          id={tipId}
          ref={tipRef}
          className={[
            'match-preds-info-tooltip',
            'match-h2h-info-tooltip',
            'match-preds-info-tooltip--fixed',
            `match-preds-info-tooltip--${placement}`,
            tipStyle ? '' : 'match-preds-info-tooltip--measuring',
          ].filter(Boolean).join(' ')}
          style={tipStyle ? { top: tipStyle.top, left: tipStyle.left } : undefined}
          role="tooltip"
        >
          <p className="match-preds-info-tooltip-title">Cara a Cara</p>
          {hasWorldCup && (
            <span className="match-h2h-mundial-badge" aria-hidden="true">
              <span className="match-h2h-mundial-badge-dot" />
              Mundial
            </span>
          )}
          <div className="match-h2h-info-tooltip-summary">
            <TeamCrest src={homeCrest} alt="" size={14} />
            <span>{headToHead.homeWins}</span>
            <span className="match-h2h-info-tooltip-dot">·</span>
            <span>{headToHead.draws}</span>
            <span className="match-h2h-info-tooltip-dot">·</span>
            <span>{headToHead.awayWins}</span>
            <TeamCrest src={awayCrest} alt="" size={14} />
          </div>
          <ul className="match-h2h-info-tooltip-list">
            {headToHead.matches.map(row => {
              const crest = winnerCrest(row)
              const isWorldCup = isWorldCupH2hCompetition(row.competitionRaw || row.competition)
              const wcClass = isWorldCup ? ' match-h2h-info-tooltip-cell--worldcup' : ''
              return (
                <li key={row.id} className="match-h2h-info-tooltip-row">
                  <span className={`match-h2h-info-tooltip-date${wcClass}`}>{shortH2hDate(row.utcDate)}</span>
                  <span className={`match-h2h-info-tooltip-score${wcClass}`}>{row.scoreLabel}</span>
                  <span className={`match-h2h-info-tooltip-winner${wcClass}`} aria-hidden={!crest}>
                    {crest ? (
                      <TeamCrest
                        src={crest}
                        alt=""
                        size={12}
                      />
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>,
        document.body,
      )
      : null

  return (
    <>
      <div
        className={[
          'match-h2h-info-wrap',
          open ? 'match-h2h-info-wrap--open' : '',
          isBracket ? 'match-h2h-info-wrap--bracket' : '',
          className,
        ].filter(Boolean).join(' ')}
        ref={wrapRef}
      >
        <button
          type="button"
          className={[
            'schedule-match-h2h-btn',
            isBracket ? 'schedule-match-h2h-btn--bracket' : '',
          ].filter(Boolean).join(' ')}
          aria-expanded={open}
          aria-describedby={open ? tipId : undefined}
          aria-label={`Cara a cara: ${homeName} vs ${awayName}`}
          onClick={e => {
            e.stopPropagation()
            setOpen(v => !v)
          }}
        >
          Cara a Cara
        </button>
      </div>
      {tooltip}
    </>
  )
}
