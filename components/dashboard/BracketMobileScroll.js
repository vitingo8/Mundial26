'use client'

import { useState, useCallback, useRef } from 'react'
import BracketMatchSlot from './BracketMatchSlot'
import { Icon } from '../icons'
import { BRACKET_MOBILE_COLUMNS } from '../../lib/bracketMobileColumns'
import { BRACKET_CENTER } from '../../lib/knockoutBracketTreeLayout'
import { resolveApiRawForMatch } from '../../lib/apiMatchScores'

function BracketMobileColumn({ column, getMatch, ...slotProps }) {
  const { layout } = column

  return (
    <div
      className={`bracket-mobile-col bracket-mobile-col--${column.id}`}
      aria-label={column.label}
      style={{ '--bracket-mobile-slot-h': `${layout.slotH}px` }}
    >
      <header className="bracket-mobile-col-label">{column.label}</header>
      <div
        className="bracket-mobile-col-grid"
        style={{
          gridTemplateRows: column.gridTemplateRows,
          rowGap: `${layout.gap}px`,
          '--bracket-mobile-divider-top': `${column.dividerOffsetPx ?? 0}px`,
        }}
      >
        {column.dividerAfterRow > 0 && (
          <div className="bracket-mobile-band-divider" aria-hidden="true" />
        )}
        {column.cells.map(cell => {
          const m = getMatch(cell.matchNum)
          return (
            <div
              key={cell.matchNum}
              className="bracket-mobile-cell"
              style={{ gridRow: `${cell.rowStart + 1}` }}
            >
              {cell.matchNum === BRACKET_CENTER.final && (
                <img
                  src="/icon-192.png"
                  alt=""
                  className="bracket-mobile-final-logo"
                  width={32}
                  height={32}
                />
              )}
              {cell.matchNum === BRACKET_CENTER.third && (
                <span className="bracket-mobile-third-label">3.er puesto</span>
              )}
              <BracketMatchSlot
                match={m}
                pred={lookupBracketPred(slotProps.preds, m)}
                apiRaw={m ? resolveApiRawForMatch(m, slotProps.rawById) : null}
                userPred={slotProps.userPreds?.[m?.id]}
                matchRef={el => {
                  if (slotProps.matchRefs && m) slotProps.matchRefs.current[m.id] = el
                }}
                {...slotProps}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BracketMobileScroll({
  getMatch,
  error = null,
  ...slotProps
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const viewportRef = useRef(null)

  const updateIndexFromScroll = useCallback(() => {
    const el = viewportRef.current
    if (!el || el.clientWidth <= 0) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(prev => (prev !== idx ? idx : prev))
  }, [])

  const goToPhase = useCallback((index) => {
    const el = viewportRef.current
    const next = Math.max(0, Math.min(BRACKET_MOBILE_COLUMNS.length - 1, index))
    if (el && el.clientWidth > 0) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
    }
    setActiveIndex(next)
  }, [])

  return (
    <div className="knockout-bracket-scene knockout-bracket-scene--mobile">
      {error && (
        <div className="predicted-knockout-alert knockout-bracket-alert" role="status">
          {formatKnockoutErrorForUi(error)}
          {getKnockoutErrorHint(error) && (
            <span className="predicted-knockout-alert-detail">{getKnockoutErrorHint(error)}</span>
          )}
        </div>
      )}

      <div className="bracket-mobile-phase-header" aria-live="polite">
        <span className="bracket-mobile-phase-name">
          {BRACKET_MOBILE_COLUMNS[activeIndex]?.label}
        </span>
        <div className="bracket-mobile-dots" role="tablist" aria-label="Fases del cuadro">
          {BRACKET_MOBILE_COLUMNS.map((col, i) => (
            <button
              key={col.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={col.label}
              className={`bracket-mobile-dot${i === activeIndex ? ' bracket-mobile-dot--active' : ''}`}
              onClick={() => goToPhase(i)}
            />
          ))}
        </div>
      </div>

      <div className="bracket-mobile-stage">
        {activeIndex > 0 && (
          <button
            type="button"
            className="bracket-mobile-nav bracket-mobile-nav--prev"
            aria-label="Fase anterior"
            onClick={() => goToPhase(activeIndex - 1)}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
        )}
        <div
          ref={viewportRef}
          className="bracket-mobile-viewport"
          aria-label="Cuadro eliminatorio"
          onScroll={updateIndexFromScroll}
        >
          {BRACKET_MOBILE_COLUMNS.map(col => (
            <div key={col.id} className="bracket-mobile-slide">
              <BracketMobileColumn column={col} getMatch={getMatch} {...slotProps} />
            </div>
          ))}
        </div>
        {activeIndex < BRACKET_MOBILE_COLUMNS.length - 1 && (
          <button
            type="button"
            className="bracket-mobile-nav bracket-mobile-nav--next"
            aria-label="Fase siguiente"
            onClick={() => goToPhase(activeIndex + 1)}
          >
            <Icon name="chevronRight" size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
