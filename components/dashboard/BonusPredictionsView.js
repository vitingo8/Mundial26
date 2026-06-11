'use client'

import { SCORING } from '../../lib/gameData'
import { IconLabel, BONUS_FIELD_ICONS } from '../icons'

export const BONUS_PRED_FIELDS = [
  { id: 'topScorer', label: 'Máximo goleador', pts: SCORING.topScorer },
  { id: 'topKeeper', label: 'Mejor portero', pts: SCORING.topKeeper },
  { id: 'topAssists', label: 'Máximo asistente', pts: SCORING.topAssists },
  { id: 'mvp', label: 'MVP del torneo', pts: SCORING.mvp },
]

export function countFilledBonuses(bonuses = {}) {
  return BONUS_PRED_FIELDS.filter(f => String(bonuses[f.id] ?? '').trim()).length
}

export default function BonusPredictionsView({ preds = {}, readOnly = false, actuals = {} }) {
  if (readOnly && countFilledBonuses(preds) === 0) {
    return <p className="dash-empty">Aún no ha rellenado las predicciones especiales.</p>
  }

  return (
    <div className="dash-bonus-list">
      {BONUS_PRED_FIELDS.map(f => {
        const pred = String(preds[f.id] ?? '').trim()
        const actual = actuals[f.id]
        const hit =
          pred &&
          actual &&
          pred.toLowerCase() === actual.trim().toLowerCase()

        return (
          <div key={f.id} className="dash-bonus-field">
            <div className="dash-bonus-label">
              <IconLabel icon={BONUS_FIELD_ICONS[f.id]} iconSize="sm">{f.label}</IconLabel>
              {!readOnly && <span className="dash-bonus-pts">+{f.pts} pts</span>}
            </div>
            {readOnly ? (
              <p className={`participant-preds-bonus-value${pred ? '' : ' participant-preds-bonus-value--empty'}`}>
                {pred || 'Sin rellenar'}
              </p>
            ) : null}
            {readOnly && actual && pred && (
              <div className={`dash-bonus-result${hit ? ' dash-bonus-result--hit' : ''}`}>
                <span>Real: <strong>{actual}</strong></span>
                <span className="dash-bonus-result-detail">{hit ? 'Acierto' : 'No coincide'}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
