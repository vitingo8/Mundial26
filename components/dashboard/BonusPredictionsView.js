'use client'

import { SCORING } from '../../lib/gameData'
import { Icon, BONUS_FIELD_ICONS } from '../icons'

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

  if (readOnly) {
    return (
      <div className="participant-preds-bonus-list">
        {BONUS_PRED_FIELDS.map(f => {
          const pred = String(preds[f.id] ?? '').trim()
          const actual = actuals[f.id]
          const hit =
            pred &&
            actual &&
            pred.toLowerCase() === actual.trim().toLowerCase()

          return (
            <article key={f.id} className="participant-preds-bonus-card">
              <div className="participant-preds-bonus-card-head">
                <span className="participant-preds-bonus-icon" aria-hidden="true">
                  <Icon name={BONUS_FIELD_ICONS[f.id]} size="sm" />
                </span>
                <span className="participant-preds-bonus-label">{f.label}</span>
              </div>
              <p className={`participant-preds-bonus-value${pred ? '' : ' participant-preds-bonus-value--empty'}`}>
                {pred || 'Sin rellenar'}
              </p>
              {actual && pred && (
                <div className={`participant-preds-bonus-result${hit ? ' participant-preds-bonus-result--hit' : ''}`}>
                  <span className="participant-preds-bonus-result-real">
                    Real: <strong>{actual}</strong>
                  </span>
                  <span className="participant-preds-bonus-result-badge">
                    {hit ? 'Acierto' : 'No coincide'}
                  </span>
                </div>
              )}
            </article>
          )
        })}
      </div>
    )
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
              <span>{f.label}</span>
              <span className="dash-bonus-pts">+{f.pts} pts</span>
            </div>
            {actual && pred && (
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
