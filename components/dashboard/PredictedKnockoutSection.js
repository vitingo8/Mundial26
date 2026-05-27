'use client'

import { useMemo } from 'react'
import {
  buildInicioKnockoutSchedule,
  formatKnockoutErrorForUi,
  getKnockoutErrorHint,
} from '../../lib/knockoutBridge'
import MatchDaySchedule from './MatchDaySchedule'
import { patchKnockoutScore, patchKnockoutAdvance } from '../../lib/knockoutAdvances'
import { countFilledMatches } from '../../lib/predictionUtils'

export default function PredictedKnockoutSection({
  groupMatches,
  groupPreds,
  inicioKoPreds,
  setInicioKoPreds,
  locked,
  matchRefs,
  viewMode = 'daily',
  /** En vista Día el calendario unificado va en GroupPhasePreds */
  hideSchedule = false,
}) {
  const { schedule, error } = useMemo(
    () => buildInicioKnockoutSchedule(groupMatches, groupPreds, inicioKoPreds),
    [groupMatches, groupPreds, inicioKoPreds],
  )

  function setScore(id, side, val) {
    setInicioKoPreds(p => patchKnockoutScore(p, id, side, val))
  }

  function setAdvance(id, side) {
    setInicioKoPreds(p => patchKnockoutAdvance(p, id, side))
  }

  if (!groupMatches.length) return null
  if (hideSchedule && !error) return null

  const filledGroup = countFilledMatches(groupPreds, groupMatches)
  const showGroupHint = filledGroup === 0 && schedule.length === 0 && !error

  const sectionClass = [
    'predicted-knockout-section',
    hideSchedule ? 'predicted-knockout-section--embedded' : '',
    viewMode === 'full' ? 'predicted-knockout-section--full' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={sectionClass}>
      {error && (
        <div className="predicted-knockout-alert" role="status">
          {formatKnockoutErrorForUi(error)}
          {getKnockoutErrorHint(error) && (
            <span className="predicted-knockout-alert-detail">{getKnockoutErrorHint(error)}</span>
          )}
        </div>
      )}

      {showGroupHint && (
        <p className="predicted-knockout-hint" role="status">
          Rellena al menos un partido de grupos para calcular dieciseisavos y el cuadro previsto.
        </p>
      )}

      {schedule.length > 0 && !hideSchedule && (
        <MatchDaySchedule
          matches={schedule}
          preds={inicioKoPreds}
          locked={locked}
          matchRefs={matchRefs}
          onScore={setScore}
          onAdvance={setAdvance}
          schedulePhase="knockout"
          viewMode={viewMode}
          flatMatchesPanel
        />
      )}
    </section>
  )
}
