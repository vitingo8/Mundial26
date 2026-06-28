'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCountdown } from '../../lib/phaseLock'
import {
  ELIMINATORIAS_REMINDER_WINDOW_MS,
  getEliminatoriasReminderMatches,
  readElimReminderDismissed,
  writeElimReminderDismissed,
} from '../../lib/eliminatoriasReminder'
import { Icon } from '../icons'

export default function EliminatoriasReminderBanner({
  groupId,
  knockoutMatches = [],
  koPreds = {},
  fotmobStandings = null,
  groupMatches = [],
  apiMatches = [],
  groupPhase = 'knockout',
  onGoToMatch,
}) {
  const [dismissed, setDismissed] = useState([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setDismissed(readElimReminderDismissed(groupId))
  }, [groupId])

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const matches = useMemo(
    () => getEliminatoriasReminderMatches({
      knockoutMatches,
      koPreds,
      fotmobStandings,
      groupMatches,
      apiMatches,
      dismissedIds: dismissed,
      groupPhase,
    }),
  // tick refresca la ventana de 24 h y el texto del countdown
    [knockoutMatches, koPreds, fotmobStandings, groupMatches, apiMatches, dismissed, groupPhase, tick],
  )

  if (!matches.length) return null

  const match = matches[0]
  const msUntil = new Date(match.utcDate).getTime() - Date.now()
  if (msUntil <= 0 || msUntil > ELIMINATORIAS_REMINDER_WINDOW_MS) return null

  const countdown = formatCountdown(msUntil)
  const moreCount = matches.length - 1

  function dismiss() {
    const id = String(match.id)
    const next = [...new Set([...dismissed, id])]
    setDismissed(next)
    writeElimReminderDismissed(groupId, next)
  }

  function handleOpen() {
    onGoToMatch?.(match.id)
  }

  return (
    <div className="elim-reminder" role="status" aria-live="polite">
      <button type="button" className="elim-reminder__action" onClick={handleOpen}>
        <Icon name="clock" size="sm" className="elim-reminder__icon" />
        <span className="elim-reminder__text">
          Sin predicción · {match.home}–{match.away} en {countdown}
          {moreCount > 0 ? ` (+${moreCount})` : ''}
        </span>
      </button>
      <button
        type="button"
        className="elim-reminder__close"
        onClick={dismiss}
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  )
}
