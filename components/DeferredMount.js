'use client'

import { useEffect, useState } from 'react'
import { deferAfterPaint } from '../lib/deferToIdle'

/**
 * Monta children un frame después de pintar el fallback.
 * Evita bloquear el hilo principal justo tras parsear un chunk grande.
 */
export default function DeferredMount({ children, fallback = null }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    return deferAfterPaint(() => setReady(true), { idleTimeout: 120 })
  }, [])

  if (!ready) return fallback
  return children
}
