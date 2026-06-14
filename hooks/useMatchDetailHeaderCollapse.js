'use client'

import { useEffect, useRef, useState } from 'react'

const MOBILE_MQ = '(max-width: 639px)'
const COLLAPSE_SCROLL_PX = 240
/** Umbral mínimo de gesto hacia arriba/abajo para plegar/desplegar */
const GESTURE_COMMIT_PX = 14
const COLLAPSED_THRESHOLD = 0.985
const COLLAPSE_LERP = 0.24

function contentScrollAllowed(collapse, target) {
  return collapse >= COLLAPSED_THRESHOLD && target >= COLLAPSED_THRESHOLD
}

/**
 * Colapsa el header del detalle de partido en móvil.
 * Un gesto hacia arriba pliega el header por completo; hacia abajo lo despliega.
 * @returns {boolean} headerScrollLocked — true mientras el panel no puede desplazarse
 */
export function useMatchDetailHeaderCollapse({
  headerRef,
  expandRef,
  bodyRef,
  activeTab,
  matchId,
  enabled = true,
  contentKey = '',
}) {
  const collapseRef = useRef(0)
  const targetRef = useRef(0)
  const lockedRef = useRef(true)
  const [headerScrollLocked, setHeaderScrollLocked] = useState(false)

  useEffect(() => {
    collapseRef.current = 0
    targetRef.current = 0
    lockedRef.current = true
    setHeaderScrollLocked(false)
    const header = headerRef.current
    if (header) {
      header.style.setProperty('--md-header-collapse', '0')
      header.classList.remove('match-detail-header--collapsed')
      header.classList.remove('match-detail-header--scroll-locked')
    }
  }, [activeTab, matchId, headerRef])

  useEffect(() => {
    const header = headerRef.current
    const expand = expandRef.current
    if (!header || !expand) return undefined

    if (!enabled) {
      lockedRef.current = false
      setHeaderScrollLocked(false)
      header.style.setProperty('--md-header-collapse', '0')
      header.classList.remove('match-detail-header--collapsed')
      header.classList.remove('match-detail-header--scroll-locked')
      return undefined
    }

    const mq = window.matchMedia(MOBILE_MQ)
    if (!mq.matches) return undefined

    const syncExpandHeight = () => {
      header.style.setProperty('--md-header-expand-h', `${expand.scrollHeight}px`)
    }

    const ro = new ResizeObserver(syncExpandHeight)
    ro.observe(expand)
    syncExpandHeight()

    let scrollEl = null
    let collapsePx = 0
    let animRef = 0
    let lastTouchY = 0
    let touchTracking = false
    let gestureDy = 0

    function updateLockedState(locked) {
      header.classList.toggle('match-detail-header--scroll-locked', locked)
      scrollEl?.classList.toggle('match-detail-panel--header-locked', locked)
      if (locked !== lockedRef.current) {
        lockedRef.current = locked
        setHeaderScrollLocked(locked)
      }
    }

    function applyCollapse(value) {
      const p = Math.min(1, Math.max(0, value))
      collapseRef.current = p
      header.style.setProperty('--md-header-collapse', String(p))
      header.classList.toggle('match-detail-header--collapsed', p > 0.96)
      updateLockedState(!contentScrollAllowed(p, targetRef.current))
    }

    function syncLockedFromTarget() {
      updateLockedState(!contentScrollAllowed(collapseRef.current, targetRef.current))
    }

    function stopAnimation() {
      if (animRef) {
        cancelAnimationFrame(animRef)
        animRef = 0
      }
    }

    function tick() {
      const current = collapseRef.current
      const target = targetRef.current
      const diff = target - current

      if (Math.abs(diff) < 0.001) {
        applyCollapse(target)
        animRef = 0
        return
      }

      applyCollapse(current + diff * COLLAPSE_LERP)
      animRef = requestAnimationFrame(tick)
    }

    function ensureAnimation() {
      if (!animRef) animRef = requestAnimationFrame(tick)
    }

    function commitCollapse() {
      collapsePx = COLLAPSE_SCROLL_PX
      targetRef.current = 1
      syncLockedFromTarget()
      ensureAnimation()
    }

    function commitExpand() {
      collapsePx = 0
      targetRef.current = 0
      syncLockedFromTarget()
      ensureAnimation()
    }

    function isScrollLocked() {
      return !contentScrollAllowed(collapseRef.current, targetRef.current)
    }

    function absorbPanelScroll() {
      if (!scrollEl || scrollEl.scrollTop <= 0) return
      scrollEl.scrollTop = 0
    }

    function lockScrollPosition() {
      if (!scrollEl || !isScrollLocked()) return
      absorbPanelScroll()
    }

    function handleLockedGesture(deltaY) {
      if (!scrollEl || !deltaY) return
      absorbPanelScroll()
      gestureDy += deltaY
      scrollEl.scrollTop = 0

      if (gestureDy >= GESTURE_COMMIT_PX) {
        commitCollapse()
      }
    }

    function handleExpandGesture(deltaY) {
      if (!scrollEl || !deltaY) return
      gestureDy += deltaY
      scrollEl.scrollTop = 0

      if (gestureDy <= -GESTURE_COMMIT_PX) {
        commitExpand()
      }
    }

    function onScroll() {
      lockScrollPosition()
    }

    function onTouchStart(e) {
      if (!scrollEl || e.touches.length !== 1) return
      touchTracking = true
      gestureDy = 0
      lastTouchY = e.touches[0].clientY
    }

    function onTouchMove(e) {
      if (!scrollEl || !touchTracking || e.touches.length !== 1) return

      const y = e.touches[0].clientY
      const dy = lastTouchY - y
      lastTouchY = y

      if (!dy) return

      if (isScrollLocked()) {
        e.preventDefault()
        handleLockedGesture(dy)
        return
      }

      if (dy < 0 && collapsePx > 0 && scrollEl.scrollTop <= 0) {
        e.preventDefault()
        handleExpandGesture(dy)
      }
    }

    function onTouchEnd() {
      if (touchTracking && scrollEl) {
        if (isScrollLocked() && gestureDy > 0) {
          commitCollapse()
        } else if (!isScrollLocked() && collapsePx > 0 && scrollEl.scrollTop <= 0 && gestureDy < 0) {
          commitExpand()
        }
      }
      touchTracking = false
      gestureDy = 0
    }

    function onWheel(e) {
      if (!scrollEl) return

      if (isScrollLocked()) {
        if (e.deltaY > 0) {
          e.preventDefault()
          commitCollapse()
        }
        return
      }

      if (e.deltaY < 0 && collapsePx > 0 && scrollEl.scrollTop <= 0) {
        e.preventDefault()
        commitExpand()
      }
    }

    function unbindScrollEl() {
      if (!scrollEl) return
      scrollEl.removeEventListener('scroll', onScroll)
      scrollEl.removeEventListener('touchstart', onTouchStart)
      scrollEl.removeEventListener('touchmove', onTouchMove)
      scrollEl.removeEventListener('touchend', onTouchEnd)
      scrollEl.removeEventListener('touchcancel', onTouchEnd)
      scrollEl.removeEventListener('wheel', onWheel)
      scrollEl.classList.remove('match-detail-panel--header-locked')
    }

    function bindScroll() {
      unbindScrollEl()
      scrollEl = bodyRef.current?.querySelector('.swipe-tabs-panel[aria-hidden="false"]')
      if (!scrollEl) return

      collapsePx = 0
      targetRef.current = 0
      applyCollapse(0)
      scrollEl.scrollTop = 0
      updateLockedState(true)

      scrollEl.addEventListener('scroll', onScroll, { passive: true })
      scrollEl.addEventListener('touchstart', onTouchStart, { passive: true })
      scrollEl.addEventListener('touchmove', onTouchMove, { passive: false })
      scrollEl.addEventListener('touchend', onTouchEnd, { passive: true })
      scrollEl.addEventListener('touchcancel', onTouchEnd, { passive: true })
      scrollEl.addEventListener('wheel', onWheel, { passive: false })
    }

    bindScroll()
    const bindTimer = setTimeout(bindScroll, 0)

    function onMqChange() {
      if (!mq.matches) {
        stopAnimation()
        unbindScrollEl()
        collapsePx = 0
        targetRef.current = 0
        collapseRef.current = 0
        lockedRef.current = false
        setHeaderScrollLocked(false)
        header.style.setProperty('--md-header-collapse', '0')
        header.classList.remove('match-detail-header--collapsed')
        header.classList.remove('match-detail-header--scroll-locked')
      } else {
        bindScroll()
      }
    }

    mq.addEventListener('change', onMqChange)

    return () => {
      clearTimeout(bindTimer)
      stopAnimation()
      unbindScrollEl()
      ro.disconnect()
      mq.removeEventListener('change', onMqChange)
      collapsePx = 0
      targetRef.current = 0
      collapseRef.current = 0
      lockedRef.current = false
      setHeaderScrollLocked(false)
      header.style.setProperty('--md-header-collapse', '0')
      header.classList.remove('match-detail-header--collapsed')
      header.classList.remove('match-detail-header--scroll-locked')
    }
  }, [enabled, activeTab, matchId, contentKey, bodyRef, headerRef, expandRef])

  return headerScrollLocked
}
