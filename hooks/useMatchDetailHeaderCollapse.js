'use client'

import { useEffect, useRef } from 'react'

const MOBILE_MQ = '(max-width: 639px)'
const COLLAPSE_SCROLL_PX = 112

/**
 * Colapsa el header del detalle de partido en móvil según scroll del panel activo.
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

  useEffect(() => {
    collapseRef.current = 0
    const header = headerRef.current
    if (header) {
      header.style.setProperty('--md-header-collapse', '0')
      header.classList.remove('match-detail-header--collapsed')
    }
  }, [activeTab, matchId, headerRef])

  useEffect(() => {
    const header = headerRef.current
    const expand = expandRef.current
    if (!header || !expand) return undefined

    if (!enabled) {
      header.style.setProperty('--md-header-collapse', '0')
      header.classList.remove('match-detail-header--collapsed')
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
    let raf = 0

    function getScrollEl() {
      return bodyRef.current?.querySelector('.swipe-tabs-panel[aria-hidden="false"]')
    }

    function applyCollapse(scrollTop) {
      const p = Math.min(1, Math.max(0, scrollTop / COLLAPSE_SCROLL_PX))
      if (Math.abs(p - collapseRef.current) < 0.002) return
      collapseRef.current = p
      header.style.setProperty('--md-header-collapse', String(p))
      header.classList.toggle('match-detail-header--collapsed', p > 0.96)
    }

    function onScroll() {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (scrollEl) applyCollapse(scrollEl.scrollTop)
      })
    }

    function bindScroll() {
      scrollEl?.removeEventListener('scroll', onScroll)
      scrollEl = getScrollEl()
      scrollEl?.addEventListener('scroll', onScroll, { passive: true })
      applyCollapse(scrollEl?.scrollTop ?? 0)
    }

    bindScroll()
    const bindTimer = setTimeout(bindScroll, 0)

    function onMqChange() {
      if (!mq.matches) {
        collapseRef.current = 0
        header.style.setProperty('--md-header-collapse', '0')
        header.classList.remove('match-detail-header--collapsed')
      } else {
        bindScroll()
      }
    }

    mq.addEventListener('change', onMqChange)

    return () => {
      clearTimeout(bindTimer)
      ro.disconnect()
      scrollEl?.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
      mq.removeEventListener('change', onMqChange)
      collapseRef.current = 0
      header.style.setProperty('--md-header-collapse', '0')
      header.classList.remove('match-detail-header--collapsed')
    }
  }, [enabled, activeTab, matchId, contentKey, bodyRef, headerRef, expandRef])
}
