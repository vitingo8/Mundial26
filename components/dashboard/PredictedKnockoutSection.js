'use client'

import { useMemo } from 'react'
import {
  buildInicioKnockoutSchedule,
  formatKnockoutErrorForUi,
  getKnockoutErrorHint,
} from '../../lib/knockoutBridge'
import MatchDaySchedule from './MatchDaySchedule'
import { patchKnockoutScore, patchKnockoutAdvance } from '../../lib/knockoutAdvances'

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
  publishedResults = {},
  knockoutMatches = [],
  inicioKnockoutScoring = null,
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
          publishedResults={publishedResults}
          knockoutMatches={knockoutMatches}
          inicioKnockoutScoring={inicioKnockoutScoring}
        />
      )}
    </section>
  )
}
