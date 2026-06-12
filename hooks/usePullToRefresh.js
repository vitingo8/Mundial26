'use client'

import { useEffect, useRef, useState } from 'react'

const PULL_THRESHOLD = 72
const MAX_PULL = 96

export function usePullToRefresh(onRefresh, { enabled = true } = {}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)
  const startY = useRef(0)
  const pulling = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!enabled) {
      setPull(0)
      pullRef.current = 0
      return undefined
    }

    function atTop() {
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

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
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
