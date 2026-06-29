'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { findParticipantsByEmail } from '../lib/participantLookup'
import {
  countMergeableGaps,
  formatMirrorSummary,
  mergePredictions,
  pushPredictionsToParticipant,
  summarizePredictions,
} from '../lib/predictionMirror'
import { Icon } from './icons'

export default function PredictionExportSheet({
  user,
  currentGroupId,
  currentGroupName,
  sourcePredictions,
  onBeforeExport,
  notify,
}) {
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const sourceSummary = summarizePredictions(sourcePredictions)
  const canExport = sourceSummary.total > 0

  useEffect(() => {
    if (!open || !user?.email) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const all = await findParticipantsByEmail(supabase, user.email)
        const others = all.filter(p => p.group_id !== currentGroupId)
        if (!others.length) {
          if (!cancelled) setTargets([])
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
          summary: summarizePredictions(predMap[p.id]?.predictions),
          gapCount: countMergeableGaps(predMap[p.id]?.predictions, sourcePredictions),
        }))
        if (!cancelled) setTargets(enriched)
      } catch {
        if (!cancelled) setTargets([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, user?.email, user?.id, currentGroupId, sourcePredictions])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  async function exportToTarget(target, mode = 'fillGaps') {
    if (!target?.id) return
    const gaps = countMergeableGaps(target.predictions, sourcePredictions)
    if (mode === 'fillGaps' && gaps === 0) {
      notify('Ese grupo no tiene huecos que rellenar', 'warning')
      return
    }
    const msg = mode === 'replace'
      ? `¿Sustituir la porra de «${target.groupName}» por la de «${currentGroupName}»?`
      : `¿Copiar ${gaps} predicción${gaps === 1 ? '' : 'es'} de «${currentGroupName}» a «${target.groupName}»?`
    if (!window.confirm(msg)) return

    setBusyId(`${target.id}:${mode}`)
    try {
      await onBeforeExport?.()
      await pushPredictionsToParticipant(
        supabase,
        target.id,
        target.predictions,
        sourcePredictions,
        mode,
      )
      notify(
        mode === 'replace'
          ? `Porra enviada a ${target.groupName}`
          : `Enviado a ${target.groupName}`,
      )
      setTargets(prev => (prev || []).map(t => {
        if (t.id !== target.id) return t
        const merged = mergePredictions(t.predictions, sourcePredictions, mode)
        return {
          ...t,
          predictions: merged,
          summary: summarizePredictions(merged),
          gapCount: countMergeableGaps(merged, sourcePredictions),
        }
      }))
    } catch (err) {
      notify(err.message || 'No se pudo traspasar', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <button
        type="button"
        className="header-action-btn header-action-btn--header"
        title="Traspasar porra a otros grupos"
        aria-label="Traspasar porra a otros grupos"
        disabled={!canExport}
        onClick={() => setOpen(true)}
      >
        <Icon name="arrowPath" size="sm" />
        <span className="header-action-btn__text">Traspasar</span>
      </button>

      {open && (
        <div
          className="install-app-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prediction-export-title"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="install-app-sheet prediction-export-sheet">
            <button
              type="button"
              className="install-app-close"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2 id="prediction-export-title" className="install-app-title">
              Traspasar porra
            </h2>
            <p className="prediction-export-lead">
              Desde <strong>{currentGroupName}</strong>
              {' '}({formatMirrorSummary(sourceSummary)}) hacia tus otros grupos.
              Solo se rellenan huecos vacíos, salvo que elijas sustituir.
            </p>

            {loading ? (
              <p className="prediction-export-empty">Cargando grupos…</p>
            ) : !canExport ? (
              <p className="prediction-export-empty">
                Aún no hay predicciones en este grupo para enviar.
              </p>
            ) : !(targets || []).length ? (
              <p className="prediction-export-empty">No hay otros grupos disponibles.</p>
            ) : (
              <ul className="prediction-export-list">
                {(targets || []).map(t => {
                  const gapHint = t.gapCount > 0
                    ? `${t.gapCount} hueco${t.gapCount === 1 ? '' : 's'} por rellenar`
                    : t.summary.total > 0
                      ? 'Sin huecos nuevos'
                      : 'Grupo vacío'
                  return (
                    <li key={t.id} className="prediction-export-row">
                      <div className="prediction-export-meta">
                        <span className="prediction-export-name">{t.groupName}</span>
                        <span className="prediction-export-summary">
                          {t.summary.total > 0 ? formatMirrorSummary(t.summary) : 'Sin predicciones'}
                        </span>
                        <span className="prediction-export-gaps">{gapHint}</span>
                      </div>
                      <div className="prediction-export-actions">
                        <button
                          type="button"
                          className="mirror-import-btn mirror-import-btn--primary"
                          disabled={!!busyId || t.gapCount === 0}
                          onClick={() => exportToTarget(t, 'fillGaps')}
                        >
                          {busyId === `${t.id}:fillGaps` ? 'Enviando…' : 'Rellenar huecos'}
                        </button>
                        <button
                          type="button"
                          className="mirror-import-btn mirror-import-btn--ghost"
                          disabled={!!busyId}
                          onClick={() => exportToTarget(t, 'replace')}
                        >
                          {busyId === `${t.id}:replace` ? 'Enviando…' : 'Sustituir todo'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
