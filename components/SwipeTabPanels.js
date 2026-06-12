'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MOBILE_MQ = '(max-width: 639px)'
const COMMIT_RATIO = 0.22
const LOCK_RATIO = 1.25
const EDGE_RUBBER = 0.3

const NO_SWIPE_SELECTOR = [
  '.schedule-day-picker',
  '.stats-table-scroll',
  '.lineup-pitch-filters',
  '.group-view-toggle',
  '.dash-phase-picker',
  '.match-events-list',
  '.knockout-bracket-tree-wrap',
  '.player-detail-shot-pills',
].join(', ')

function touchInNoSwipeZone(target) {
  return target?.closest?.(NO_SWIPE_SELECTOR) != null
}

/**
 * Pestañas con arrastre horizontal (estilo FotMob) en móvil.
 * @param {object} props
 * @param {string[]} props.tabs
 * @param {string} props.activeTab
 * @param {(tabId: string) => void} props.onChange
 * @param {Record<string, React.ReactNode>} props.panels
 * @param {boolean} [props.enabled]
 * @param {boolean} [props.panelScroll] — scroll vertical dentro de cada panel (diálogos)
 */
export default function SwipeTabPanels({
  tabs,
  activeTab,
  onChange,
  panels,
  enabled = true,
  panelScroll = false,
  className = '',
  viewportClassName = '',
}) {
  const viewportRef = useRef(null)
  const dragXRef = useRef(0)
  const dragStateRef = useRef({ active: false, startX: 0, startY: 0, locked: false })
  const onChangeRef = useRef(onChange)
  const tabsRef = useRef(tabs)
  const activeTabRef = useRef(activeTab)

  const [width, setWidth] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [animate, setAnimate] = useState(true)

  onChangeRef.current = onChange
  tabsRef.current = tabs
  activeTabRef.current = activeTab
  dragXRef.current = dragX

  const activeIndex = Math.max(0, tabs.indexOf(activeTab))

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setWidth(w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!dragging) {
      setDragX(0)
      setAnimate(true)
    }
  }, [activeTab, dragging])

  const clampDrag = useCallback((dx, index) => {
    if (index <= 0 && dx > 0) return dx * EDGE_RUBBER
    if (index >= tabs.length - 1 && dx < 0) return dx * EDGE_RUBBER
    return dx
  }, [tabs.length])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !enabled) return undefined

    let mobile = window.matchMedia(MOBILE_MQ).matches
    const mq = window.matchMedia(MOBILE_MQ)
    const syncMq = () => { mobile = mq.matches }
    mq.addEventListener('change', syncMq)

    function resetDrag() {
      dragStateRef.current = { active: false, startX: 0, startY: 0, locked: false }
      setDragging(false)
      setDragX(0)
      setAnimate(true)
    }

    function onStart(e) {
      if (!mobile || touchInNoSwipeZone(e.target)) return
      dragStateRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        locked: false,
      }
    }

    function onMove(e) {
      const d = dragStateRef.current
      if (!d.active || !mobile) return
      const dx = e.touches[0].clientX - d.startX
      const dy = e.touches[0].clientY - d.startY
      if (!d.locked) {
        if (Math.abs(dx) < 8) return
        if (Math.abs(dx) < Math.abs(dy) * LOCK_RATIO) return
        d.locked = true
        setDragging(true)
        setAnimate(false)
      }
      e.preventDefault()
      const idx = Math.max(0, tabsRef.current.indexOf(activeTabRef.current))
      const clamped = clampDrag(dx, idx)
      dragXRef.current = clamped
      setDragX(clamped)
    }

    function onEnd() {
      const d = dragStateRef.current
      if (!d.active) return
      d.active = false
      if (!d.locked || !mobile) {
        resetDrag()
        return
      }

      const idx = Math.max(0, tabsRef.current.indexOf(activeTabRef.current))
      const w = viewportRef.current?.clientWidth || 0
      const dx = dragXRef.current
      const threshold = w * COMMIT_RATIO

      if (dx < -threshold && idx < tabsRef.current.length - 1) {
        onChangeRef.current(tabsRef.current[idx + 1])
      } else if (dx > threshold && idx > 0) {
        onChangeRef.current(tabsRef.current[idx - 1])
      }

      resetDrag()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })

    return () => {
      mq.removeEventListener('change', syncMq)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, clampDrag])

  const offset = width ? -activeIndex * width + dragX : 0
  const trackClass = [
    'swipe-tabs-track',
    animate && !dragging ? 'swipe-tabs-track--animate' : '',
  ].filter(Boolean).join(' ')
  const viewportClass = [
    'swipe-tabs-viewport',
    panelScroll ? 'swipe-tabs-viewport--scroll-panels' : '',
    viewportClassName,
  ].filter(Boolean).join(' ')
  const rootClass = ['swipe-tabs-root', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <div ref={viewportRef} className={viewportClass}>
        <div
          className={trackClass}
          style={{
            width: width ? `${tabs.length * width}px` : `${tabs.length * 100}%`,
            transform: width ? `translate3d(${offset}px, 0, 0)` : `translate3d(-${activeIndex * 100}%, 0, 0)`,
          }}
        >
          {tabs.map(tabId => (
            <div
              key={tabId}
              className={`swipe-tabs-panel${panelScroll ? ' swipe-tabs-panel--scroll' : ''}`}
              style={width ? { width: `${width}px` } : undefined}
              role="tabpanel"
              aria-hidden={activeTab !== tabId}
            >
              {panels[tabId] ?? null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
