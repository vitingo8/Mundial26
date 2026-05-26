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
}) {
  const { schedule, error, combinationKey } = useMemo(
    () => buildInicioKnockoutSchedule(groupMatches, groupPreds),
    [groupMatches, groupPreds],
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

  return (
    <section className="predicted-knockout-section">
      <header className="predicted-knockout-header">
        <h3 className="predicted-knockout-title">Eliminatorias previstas (60%)</h3>
        <p className="predicted-knockout-hint">
          Cruces calculados con tus resultados de grupos y la tabla oficial de mejores terceros.
          {combinationKey && (
            <span className="predicted-knockout-key"> Combinación: {combinationKey}</span>
          )}
        </p>
      </header>

      {error && (
        <div className="predicted-knockout-alert" role="status">
          {formatKnockoutErrorForUi(error)}
          {getKnockoutErrorHint(error) && (
            <span className="predicted-knockout-alert-detail">{getKnockoutErrorHint(error)}</span>
          )}
        </div>
      )}

      {schedule.length > 0 && (
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
