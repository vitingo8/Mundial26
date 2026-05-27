'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getStoredWriteToken } from '../lib/sessionToken'
import { findParticipantsByEmail } from '../lib/participantLookup'
import {
  mergePredictions,
  summarizePredictions,
} from '../lib/predictionMirror'

export default function PredictionMirrorPanel({
  user,
  currentGroupId,
  currentPredictions,
  onApplyToCurrent,
  onSwitchGroup,
  notify,
}) {
  const [siblings, setSiblings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const currentSummary = summarizePredictions(currentPredictions)

  useEffect(() => {
    let cancelled = false
    if (!user?.email) {
      setSiblings([])
      setLoading(false)
      return
    }
    setLoading(true)
    ;(async () => {
      try {
        const all = await findParticipantsByEmail(supabase, user.email)
        const others = all.filter(p => p.group_id !== currentGroupId)
        if (!others.length) {
          if (!cancelled) setSiblings([])
          return
        }
        const ids = others.map(p => p.id)
        const { data: rows } = await supabase
          .from('porra_participants')
          .select('id, predictions, updated_at')
          .in('id', ids)
        const predMap = Object.fromEntries((rows || []).map(r => [r.id, r]))
        const enriched = others.map(p => ({
          ...p,
          predictions: predMap[p.id]?.predictions,
          updated_at: predMap[p.id]?.updated_at,
          summary: summarizePredictions(predMap[p.id]?.predictions),
        }))
        if (!cancelled) setSiblings(enriched)
      } catch {
        if (!cancelled) setSiblings([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.email, user?.id, currentGroupId])

  if (loading || currentSummary.total > 0) return null

  const sources = (siblings || []).filter(s => s.summary?.total > 0)
  if (!sources.length) return null

  async function copyFromSibling(sibling) {
    if (!sibling.predictions) {
      notify('Ese grupo no tiene porra guardada', 'warning')
      return
    }
    if (!window.confirm(`¿Importar la porra de «${sibling.groupName}» en este grupo?`)) return

    setBusyId(sibling.id)
    try {
      const merged = mergePredictions(currentPredictions, sibling.predictions, 'fillGaps')
      const ok = await onApplyToCurrent(merged)
      if (ok) notify(`Importado desde ${sibling.groupName}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <aside className="mirror-import-card" aria-label="Copiar porra de otro grupo">
      <p className="mirror-import-note">
        Participas en más de un grupo y aquí aún no hay predicciones. Puedes copiar la porra de otro
        grupo <strong>solo en los huecos vacíos</strong>, sin pisar lo que ya tengas.
      </p>
      <ul className="mirror-import-list">
        {sources.map(s => (
          <li key={s.id} className="mirror-import-row">
            <span className="mirror-import-name">{s.groupName}</span>
            <span className="mirror-import-actions">
              <button
                type="button"
                className="mirror-import-btn mirror-import-btn--primary"
                disabled={!!busyId}
                onClick={() => copyFromSibling(s)}
              >
                {busyId === s.id ? 'Copiando…' : 'Copiar aquí'}
              </button>
              {onSwitchGroup && (
                <button
                  type="button"
                  className="mirror-import-link"
                  disabled={!!busyId}
                  onClick={() => onSwitchGroup(s.group_id, s.id)}
                >
                  Ir al grupo
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
