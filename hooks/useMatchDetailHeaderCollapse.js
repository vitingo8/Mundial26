'use client'

import { useEffect, useRef } from 'react'

const MOBILE_MQ = '(max-width: 639px)'
/** Más px de scroll = colapso más gradual */
const COLLAPSE_SCROLL_PX = 240
/** 0–1: menor = más suave y lento al seguir el scroll */
const COLLAPSE_LERP = 0.09

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

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
  const targetRef = useRef(0)
  const animRef = useRef(0)

  useEffect(() => {
    collapseRef.current = 0
    targetRef.current = 0
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

    function applyCollapse(value) {
      const p = Math.min(1, Math.max(0, value))
      collapseRef.current = p
      header.style.setProperty('--md-header-collapse', String(p))
      header.classList.toggle('match-detail-header--collapsed', p > 0.96)
    }

    function stopAnimation() {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current)
        animRef.current = 0
      }
    }

    function tick() {
      const current = collapseRef.current
      const target = targetRef.current
      const diff = target - current

      if (Math.abs(diff) < 0.001) {
        applyCollapse(target)
        animRef.current = 0
        return
      }

      applyCollapse(current + diff * COLLAPSE_LERP)
      animRef.current = requestAnimationFrame(tick)
    }

    function ensureAnimation() {
      if (!animRef.current) animRef.current = requestAnimationFrame(tick)
    }

    function setTargetFromScroll(scrollTop) {
      targetRef.current = smoothstep(scrollTop / COLLAPSE_SCROLL_PX)
      ensureAnimation()
    }

    function onScroll() {
      if (scrollEl) setTargetFromScroll(scrollEl.scrollTop)
    }

    function bindScroll() {
      scrollEl?.removeEventListener('scroll', onScroll)
      scrollEl = getScrollEl()
      scrollEl?.addEventListener('scroll', onScroll, { passive: true })
      setTargetFromScroll(scrollEl?.scrollTop ?? 0)
    }

    function getScrollEl() {
      return bodyRef.current?.querySelector('.swipe-tabs-panel[aria-hidden="false"]')
    }

    bindScroll()
    const bindTimer = setTimeout(bindScroll, 0)

    function onMqChange() {
      if (!mq.matches) {
        stopAnimation()
        targetRef.current = 0
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
      stopAnimation()
      ro.disconnect()
      scrollEl?.removeEventListener('scroll', onScroll)
      mq.removeEventListener('change', onMqChange)
      targetRef.current = 0
      collapseRef.current = 0
      header.style.setProperty('--md-header-collapse', '0')
      header.classList.remove('match-detail-header--collapsed')
    }
  }, [enabled, activeTab, matchId, contentKey, bodyRef, headerRef, expandRef])
}
