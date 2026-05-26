'use client'

import { useRef, useCallback, useEffect } from 'react'
import BracketMatchSlot from './BracketMatchSlot'
import { BRACKET_MOBILE_COLUMNS, BRACKET_MOBILE_ROWS } from '../../lib/bracketMobileColumns'
import { BRACKET_CENTER } from '../../lib/knockoutBracketTreeLayout'
import { formatKnockoutErrorForUi, getKnockoutErrorHint } from '../../lib/knockoutBridge'

const COL_WIDTH = 152
const COLLAPSE_THRESHOLD = COL_WIDTH * 0.55

function BracketMobileColumn({ column, getMatch, colRef, ...slotProps }) {
  const rowCount = column.rowCount || BRACKET_MOBILE_ROWS

  return (
    <section
      ref={colRef}
      className={`bracket-mobile-col bracket-mobile-col--${column.id}`}
      aria-label={column.label}
      data-round={column.id}
    >
      <header className="bracket-mobile-col-label">{column.label}</header>
      <div
        className="bracket-mobile-col-grid"
        style={{ '--bracket-mobile-rows': rowCount }}
      >
        <div className="bracket-mobile-band-divider" aria-hidden="true" />
        {column.cells.map(cell => {
          const m = getMatch(cell.matchNum)
          return (
            <div
              key={cell.matchNum}
              className="bracket-mobile-cell"
              style={{
                gridRow: `${cell.rowStart + 1} / span ${cell.rowSpan}`,
              }}
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
                pred={slotProps.preds?.[m?.id] || {}}
                apiRaw={m ? slotProps.rawById?.[m.id] : null}
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
    </section>
  )
}

export default function BracketMobileScroll({
  getMatch,
  error = null,
  ...slotProps
}) {
  const scrollRef = useRef(null)
  const colRefs = useRef([])

  const updateCollapse = useCallback(() => {
    const scroller = scrollRef.current
    if (!scroller) return

    const anchor = scroller.scrollLeft + scroller.clientWidth * 0.28

    colRefs.current.forEach(el => {
      if (!el) return
      const colCenter = el.offsetLeft + el.offsetWidth / 2
      const passed = colCenter < anchor - COLLAPSE_THRESHOLD
      el.classList.toggle('bracket-mobile-col--collapsed', passed)
    })
  }, [])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return undefined

    updateCollapse()
    scroller.addEventListener('scroll', updateCollapse, { passive: true })
    const ro = new ResizeObserver(updateCollapse)
    ro.observe(scroller)

    return () => {
      scroller.removeEventListener('scroll', updateCollapse)
      ro.disconnect()
    }
  }, [updateCollapse])

  return (
    <div className="knockout-bracket-scene knockout-bracket-scene--mobile">
      <p className="bracket-mobile-scroll-hint">
        Desliza hacia la derecha para avanzar de ronda · Arriba / abajo = cada mitad del cuadro
      </p>

      {error && (
        <div className="predicted-knockout-alert knockout-bracket-alert" role="status">
          {formatKnockoutErrorForUi(error)}
          {getKnockoutErrorHint(error) && (
            <span className="predicted-knockout-alert-detail">{getKnockoutErrorHint(error)}</span>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="bracket-mobile-scroll"
        aria-label="Cuadro eliminatorio — desliza horizontalmente"
      >
        <div className="bracket-mobile-track">
          {BRACKET_MOBILE_COLUMNS.map((col, i) => (
            <BracketMobileColumn
              key={col.id}
              column={col}
              getMatch={getMatch}
              colRef={el => { colRefs.current[i] = el }}
              {...slotProps}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
