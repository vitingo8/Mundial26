'use client'

import { useEffect, useState } from 'react'
import { deferAfterPaint } from '../lib/deferToIdle'
import { F, perfMark } from '../lib/startupPerf'

/**
 * Carga GroupDashboard solo tras el primer paint (idle).
 * El parse del chunk (~250 KB) no compite con la hidratación inicial.
 */
export function useDeferredDashboard(shouldLoad) {
  const [Component, setComponent] = useState(null)

  useEffect(() => {
    if (!shouldLoad) {
      setComponent(null)
      return undefined
    }

    let cancelled = false
    perfMark(F.DASHBOARD, 'Programada carga del chunk GroupDashboard (post-paint)')

    return deferAfterPaint(() => {
      if (cancelled) return
      const t0 = performance.now()
      import('../components/GroupDashboard')
        .then(mod => {
          if (cancelled) return
          perfMark(F.DASHBOARD, 'GroupDashboard chunk parseado', {
            duracion_ms: Math.round(performance.now() - t0),
          })
          setComponent(() => mod.default)
        })
        .catch(() => {
          if (!cancelled) setComponent(null)
        })
    }, { idleTimeout: 400 })
  }, [shouldLoad])

  return Component
}
