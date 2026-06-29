'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCountdown } from '../../lib/phaseLock'
import { formatMatchKickoff, formatMatchShortDate } from '../../lib/matchSchedule'
import {
  ELIMINATORIAS_REMINDER_WINDOW_MS,
  getEliminatoriasReminderMatches,
  getEliminatoriasPredIncompleteReason,
  readElimReminderDismissed,
  writeElimReminderDismissed,
} from '../../lib/eliminatoriasReminder'
import { lookupEliminatoriasKoPred } from '../../lib/knockoutBridge'
import { perfMark } from '../../lib/startupPerf'
import { Icon } from '../icons'

export default function EliminatoriasReminderDialog({
  groupId,
  knockoutMatches = [],
  koPreds = {},
  fotmobStandings = null,
  groupMatches = [],
  apiMatches = [],
  groupPhase = 'knockout',
  onGoToPorra,
}) {
  const [dismissed, setDismissed] = useState([])
  const [suppressed, setSuppressed] = useState(false)
  const [tick, setTick] = useState(0)
  const [checksEnabled, setChecksEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback(() => {
          if (!cancelled) {
            perfMark('EliminatoriasReminder checks habilitados (idle)')
            setChecksEnabled(true)
          }
        }, { timeout: 2000 })
      : setTimeout(() => {
          if (!cancelled) {
            perfMark('EliminatoriasReminder checks habilitados (timeout)')
            setChecksEnabled(true)
          }
        }, 300)
    return () => {
      cancelled = true
      if (typeof cancelIdleCallback !== 'undefined' && typeof requestIdleCallback !== 'undefined') {
        cancelIdleCallback(id)
      } else {
        clearTimeout(id)
      }
    }
  }, [])

  useEffect(() => {
    setDismissed(readElimReminderDismissed(groupId))
    setSuppressed(false)
  }, [groupId])

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const matches = useMemo(
    () => {
      if (!checksEnabled) return []
      const t0 = performance.now()
      const result = getEliminatoriasReminderMatches({
        knockoutMatches,
        koPreds,
        fotmobStandings,
        groupMatches,
        apiMatches,
        dismissedIds: dismissed,
        groupPhase,
      })
      perfMark('getEliminatoriasReminderMatches', {
        ms: Math.round(performance.now() - t0),
        pending: result.length,
      })
      return result
    },
    [checksEnabled, knockoutMatches, koPreds, fotmobStandings, groupMatches, apiMatches, dismissed, groupPhase, tick],
  )

  const open = matches.length > 0 && !suppressed

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  function dismissAll() {
    const ids = matches.map(m => String(m.id))
    const next = [...new Set([...dismissed, ...ids])]
    setDismissed(next)
    writeElimReminderDismissed(groupId, next)
    setSuppressed(true)
  }

  function handleGoToPorra() {
    onGoToPorra?.(matches[0])
    setSuppressed(true)
  }

  return (
    <div
      className="install-app-backdrop elim-reminder-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="elim-reminder-dialog-title"
    >
      <div className="install-app-sheet elim-reminder-dialog">
        <div className="elim-reminder-dialog__icon" aria-hidden="true">
          <Icon name="clock" size="lg" />
        </div>
        <h2 id="elim-reminder-dialog-title" className="install-app-title">
          Predicciones pendientes
        </h2>
        <p className="elim-reminder-dialog__lead">
          Tienes partidos de eliminatorias en menos de 24&nbsp;h sin marcar por completo
          (resultado y, si hay empate, quién pasa).
        </p>

        <ul className="elim-reminder-dialog__list">
          {matches.map(m => {
            const pred = lookupEliminatoriasKoPred(koPreds, m)
            const reason = getEliminatoriasPredIncompleteReason(pred)
            const msUntil = new Date(m.utcDate).getTime() - Date.now()
            const countdown = msUntil > 0 && msUntil <= ELIMINATORIAS_REMINDER_WINDOW_MS
              ? formatCountdown(msUntil)
              : null
            return (
              <li key={m.id} className="elim-reminder-dialog__item">
                <div className="elim-reminder-dialog__match">
                  <strong>{m.home} – {m.away}</strong>
                  <span className="elim-reminder-dialog__meta">
                    {formatMatchShortDate(m.utcDate)} · {formatMatchKickoff(m.utcDate)}
                    {countdown ? ` · ${countdown}` : ''}
                  </span>
                </div>
                {reason ? (
                  <span className="elim-reminder-dialog__reason">{reason}</span>
                ) : null}
              </li>
            )
          })}
        </ul>

        <div className="elim-reminder-dialog__actions">
          <button type="button" className="dash-btn-primary" onClick={handleGoToPorra}>
            Ir a la porra
          </button>
          <button type="button" className="dash-btn-ghost" onClick={dismissAll}>
            Entendido, cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
