'use client'

import { useMemo } from 'react'
import {
  buildInicioKnockoutSchedule,
  formatKnockoutErrorForUi,
  getKnockoutErrorHint,
} from '../../lib/knockoutBridge'
import MatchDaySchedule from './MatchDaySchedule'

export default function PredictedKnockoutSection({
  groupMatches,
  groupPreds,
  inicioKoPreds,
  setInicioKoPreds,
  locked,
  matchRefs,
  viewMode = 'daily',
  /** En vista diaria el calendario unificado va en GroupPhasePreds */
  hideSchedule = false,
}) {
  const { schedule, error } = useMemo(
    () => buildInicioKnockoutSchedule(groupMatches, groupPreds, inicioKoPreds),
    [groupMatches, groupPreds, inicioKoPreds],
  )

  function setScore(id, side, val) {
    if (val === '' || val === undefined) {
      setInicioKoPreds(p => {
        const next = { ...p[id] }
        delete next[side]
        if (!Object.keys(next).length) {
          const { [id]: _, ...rest } = p
          return rest
        }
        return { ...p, [id]: next }
      })
      return
    }
    const v = parseInt(val, 10)
    if (Number.isNaN(v) || v < 0 || v > 20) return
    setInicioKoPreds(p => ({ ...p, [id]: { ...p[id], [side]: v } }))
  }

  if (!groupMatches.length) return null
  if (hideSchedule && !error) return null

  return (
    <section
      className={`predicted-knockout-section${hideSchedule ? ' predicted-knockout-section--embedded' : ''}`}
    >
      {error && (
        <div className="predicted-knockout-alert" role="status">
          {formatKnockoutErrorForUi(error)}
          {getKnockoutErrorHint(error) && (
            <span className="predicted-knockout-alert-detail">{getKnockoutErrorHint(error)}</span>
          )}
        </div>
      )}

      {schedule.length > 0 && !hideSchedule && (
        <MatchDaySchedule
          matches={schedule}
          preds={inicioKoPreds}
          locked={locked}
          matchRefs={matchRefs}
          onScore={setScore}
          schedulePhase="knockout"
          viewMode={viewMode}
          getSectionKey={() => 'r32'}
          getSectionLabel={() => 'Dieciseisavos previstos'}
        />
      )}
    </section>
  )
}
