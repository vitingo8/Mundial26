'use client'

import { useEffect, useRef } from 'react'

const SWIPE_THRESHOLD = 56
const SWIPE_RATIO = 1.4
const MOBILE_MQ = '(max-width: 639px)'

const NO_SWIPE_SELECTOR = [
  '.schedule-day-picker',
  '.stats-table-scroll',
  '.lineup-pitch-filters',
  '.group-view-toggle',
  '.dash-phase-picker',
  '.match-events-list',
  '.knockout-bracket-tree-wrap',
  '.knockout-bracket-scene--mobile',
  '.bracket-mobile-viewport',
  '.player-detail-shot-pills',
].join(', ')

function hasBlockingOverlay() {
  if (typeof document === 'undefined') return false
  return document.querySelector('[role="dialog"][aria-modal="true"]') != null
}

function touchInNoSwipeZone(target) {
  return target?.closest?.(NO_SWIPE_SELECTOR) != null
}

/**
 * @param {string[]} tabs
 * @param {string} activeTab
 * @param {(tabId: string) => void} onChange
 * @param {{ enabled?: boolean, rootRef?: import('react').RefObject<HTMLElement|null> }} [options]
 *   rootRef — limit swipes to touches inside this element (dialogs)
 */
export function useSwipeTabs(tabs, activeTab, onChange, { enabled = true, rootRef = null } = {}) {
  const tabsRef = useRef(tabs)
  const activeRef = useRef(activeTab)
  const onChangeRef = useRef(onChange)
  const rootRefStable = useRef(rootRef)
  tabsRef.current = tabs
  activeRef.current = activeTab
  onChangeRef.current = onChange
  rootRefStable.current = rootRef

  useEffect(() => {
    if (!enabled) return undefined

    let mobile = false
    const mq = window.matchMedia(MOBILE_MQ)
    const syncMq = () => { mobile = mq.matches }
    syncMq()
    mq.addEventListener('change', syncMq)

    let startX = 0
    let startY = 0
    let tracking = false

    function touchInScope(target) {
      const root = rootRefStable.current?.current
      if (root) return root.contains(target)
      return true
    }

    function onTouchStart(e) {
      if (!mobile) return
      const scoped = !!rootRefStable.current?.current
      if (scoped) {
        if (!touchInScope(e.target)) return
      } else if (hasBlockingOverlay() || touchInNoSwipeZone(e.target)) {
        return
      }
      if (touchInNoSwipeZone(e.target)) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      tracking = true
    }

    function onTouchEnd(e) {
      if (!tracking) return
      tracking = false
      if (!mobile) return

      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) < SWIPE_THRESHOLD) return
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return

      const tabIds = tabsRef.current
      const current = activeRef.current
      const idx = tabIds.indexOf(current)
      if (idx < 0) return

      const nextIdx = dx < 0 ? idx + 1 : idx - 1
      if (nextIdx < 0 || nextIdx >= tabIds.length) return
      onChangeRef.current(tabIds[nextIdx])
    }

    function onTouchCancel() {
      tracking = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      mq.removeEventListener('change', syncMq)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled])
}
