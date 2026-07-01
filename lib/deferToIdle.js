/**
 * Ejecuta fn tras pintar (2× rAF) y, si existe, requestIdleCallback.
 * Devuelve función cancel.
 */
export function deferAfterPaint(fn, { idleTimeout = 300 } = {}) {
  let cancelled = false
  let idleId = null
  let timeoutId = null

  const raf1 = requestAnimationFrame(() => {
    if (cancelled) return
    requestAnimationFrame(() => {
      if (cancelled) return
      if (typeof requestIdleCallback !== 'undefined') {
        idleId = requestIdleCallback(() => {
          if (!cancelled) fn()
        }, { timeout: idleTimeout })
      } else {
        timeoutId = setTimeout(() => {
          if (!cancelled) fn()
        }, 16)
      }
    })
  })

  return () => {
    cancelled = true
    cancelAnimationFrame(raf1)
    if (idleId != null && typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(idleId)
    }
    if (timeoutId != null) clearTimeout(timeoutId)
  }
}
