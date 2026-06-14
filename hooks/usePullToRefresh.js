'use client'

import { useEffect, useRef, useState } from 'react'

const PULL_THRESHOLD = 72
const MAX_PULL = 96

export function usePullToRefresh(onRefresh, { enabled = true, getScrollElement = null } = {}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)
  const startY = useRef(0)
  const pulling = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  const getScrollElementRef = useRef(getScrollElement)
  onRefreshRef.current = onRefresh
  getScrollElementRef.current = getScrollElement

  useEffect(() => {
    if (!enabled) {
      setPull(0)
      pullRef.current = 0
      return undefined
    }

    function scrollEl() {
      return getScrollElementRef.current?.() ?? null
    }

    function atTop() {
      const el = scrollEl()
      if (el) return el.scrollTop <= 0
      return window.scrollY <= 0
    }

    function setPullDistance(value) {
      pullRef.current = value
      setPull(value)
    }

    function onTouchStart(e) {
      if (refreshing || !atTop()) return
      startY.current = e.touches[0].clientY
      pulling.current = true
    }

    function onTouchMove(e) {
      if (!pulling.current || refreshing) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        setPullDistance(0)
        return
      }
      if (!atTop()) {
        pulling.current = false
        setPullDistance(0)
        return
      }
      if (dy > 8) e.preventDefault()
      setPullDistance(Math.min(dy * 0.45, MAX_PULL))
    }

    async function onTouchEnd() {
      if (!pulling.current) return
      pulling.current = false
      const shouldRefresh = pullRef.current >= PULL_THRESHOLD
      setPullDistance(0)
      if (!shouldRefresh || refreshing) return
      setRefreshing(true)
      try {
        await onRefreshRef.current?.()
      } finally {
        setRefreshing(false)
      }
    }

    const root = scrollEl()
    const target = root ?? document

    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchmove', onTouchMove, { passive: false })
    target.addEventListener('touchend', onTouchEnd)
    target.addEventListener('touchcancel', onTouchEnd)

    return () => {
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
      target.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, refreshing])

  const hint = refreshing
    ? 'Actualizando…'
    : pull >= PULL_THRESHOLD
      ? 'Suelta para actualizar'
      : pull > 0
        ? 'Desliza para actualizar'
        : ''

  return { pull, refreshing, hint, threshold: PULL_THRESHOLD }
}
