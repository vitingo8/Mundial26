'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { findParticipantsByEmail } from '../lib/participantLookup'
import {
  countMergeableGaps,
  formatMirrorSummary,
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
          gapCount: countMergeableGaps(currentPredictions, predMap[p.id]?.predictions),
        }))
        if (!cancelled) setSiblings(enriched)
      } catch {
        if (!cancelled) setSiblings([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.email, user?.id, currentGroupId, currentPredictions])

  if (loading) return null

  const sources = (siblings || []).filter(s => s.summary?.total > 0)
  if (!sources.length) return null

  async function copyFromSibling(sibling, mode = 'fillGaps') {
    if (!sibling.predictions) {
      notify('Ese grupo no tiene porra guardada', 'warning')
      return
    }
    const gaps = countMergeableGaps(currentPredictions, sibling.predictions)
    if (mode === 'fillGaps' && gaps === 0) {
      notify('No hay huecos que rellenar desde ese grupo', 'warning')
      return
    }
    const msg = mode === 'replace'
      ? `¿Sustituir tu porra en este grupo por la de «${sibling.groupName}»?`
      : `¿Importar ${gaps} predicción${gaps === 1 ? '' : 'es'} de «${sibling.groupName}» en los huecos vacíos?`
    if (!window.confirm(msg)) return

    setBusyId(`${sibling.id}:${mode}`)
    try {
      const merged = mergePredictions(currentPredictions, sibling.predictions, mode)
      const ok = await onApplyToCurrent(merged)
      if (ok) {
        notify(mode === 'replace'
          ? `Porra sustituida desde ${sibling.groupName}`
          : `Importado desde ${sibling.groupName}`)
      }
    } finally {
      setBusyId(null)
    }
  }

  const hasCurrentPreds = currentSummary.total > 0

  return (
    <aside className="mirror-import-card" aria-label="Copiar porra de otro grupo">
      <p className="mirror-import-note">
        {hasCurrentPreds
          ? 'Participas en más de un grupo. Puedes traer predicciones de otro grupo '
          : 'Participas en más de un grupo. Puedes copiar la porra de otro grupo '}
        <strong>solo en los huecos vacíos</strong>, sin pisar lo que ya tengas.
      </p>
      <ul className="mirror-import-list">
        {sources.map(s => {
          const busy = busyId?.startsWith(`${s.id}:`)
          const summaryText = formatMirrorSummary(s.summary)
          const gapHint = s.gapCount > 0
            ? `${s.gapCount} hueco${s.gapCount === 1 ? '' : 's'} por rellenar`
            : 'Sin huecos nuevos'
          return (
            <li key={s.id} className="mirror-import-row">
              <div className="mirror-import-meta">
                <span className="mirror-import-name">{s.groupName}</span>
                <span className="mirror-import-summary">{summaryText}</span>
                <span className="mirror-import-gaps">{gapHint}</span>
              </div>
              <span className="mirror-import-actions">
                <button
                  type="button"
                  className="mirror-import-btn mirror-import-btn--primary"
                  disabled={!!busyId || s.gapCount === 0}
                  onClick={() => copyFromSibling(s, 'fillGaps')}
                >
                  {busyId === `${s.id}:fillGaps` ? 'Copiando…' : 'Rellenar huecos'}
                </button>
                {hasCurrentPreds && (
                  <button
                    type="button"
                    className="mirror-import-btn mirror-import-btn--ghost"
                    disabled={!!busyId}
                    onClick={() => copyFromSibling(s, 'replace')}
                  >
                    {busyId === `${s.id}:replace` ? 'Copiando…' : 'Sustituir todo'}
                  </button>
                )}
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
          )
        })}
      </ul>
    </aside>
  )
}
