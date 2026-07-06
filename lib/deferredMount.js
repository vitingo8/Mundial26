'use client'

import { startTransition, useEffect, useState } from 'react'

/**
 * true tras el primer frame pintado — para montar UI pesada sin bloquear el arranque.
 */
export function useDeferredMount({ timeout = 150 } = {}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    const complete = () => {
      if (cancelled) return
      startTransition(() => setReady(true))
    }
    if (typeof requestAnimationFrame !== 'undefined') {
      const id = requestAnimationFrame(() => requestAnimationFrame(complete))
      return () => {
        cancelled = true
        cancelAnimationFrame(id)
      }
    }
    const id = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback(complete, { timeout })
      : setTimeout(complete, 0)
    return () => {
      cancelled = true
      if (typeof cancelIdleCallback !== 'undefined' && typeof id === 'number') {
        cancelIdleCallback(id)
      } else {
        clearTimeout(id)
      }
    }
  }, [timeout])
  return ready
}
