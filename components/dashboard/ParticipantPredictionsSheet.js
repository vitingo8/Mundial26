'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { migratePredictionMap } from '../../lib/matchIdMap'
import { normalizeInicioKoPreds, buildInicioKnockoutSchedule } from '../../lib/knockoutBridge'
import { countFilledMatches } from '../../lib/predictionUtils'
import ParticipantDisplay, { ParticipantAvatar } from '../ParticipantDisplay'
import GroupStandingsView from './GroupStandingsView'
import KnockoutBracketView from './KnockoutBracketView'
import BonusPredictionsView from './BonusPredictionsView'

const VIEWS = [
  { id: 'groups', label: 'Clasificación' },
  { id: 'bracket', label: 'Cuadro' },
  { id: 'bonuses', label: 'Especiales' },
]

export default function ParticipantPredictionsSheet({
  participant,
  groupMatches,
  knockoutMatches = [],
  bonusActuals = {},
  publishedResults = {},
  apiMatches = [],
  onClose,
  currentUserId,
}) {
  const [view, setView] = useState('groups')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!participant) return
    setView('groups')
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [participant?.id, onClose])

  const { groupPreds, inicioKoPreds, bonusPreds } = useMemo(() => {
    const raw = participant?.predictions || {}
    const { migrated: g } = migratePredictionMap(raw.group || {}, groupMatches)
    const inicio = normalizeInicioKoPreds(raw.inicioKnockout || {})
    return {
      groupPreds: g,
      inicioKoPreds: inicio,
      bonusPreds: raw.bonuses || {},
    }
  }, [participant, groupMatches])

  const inicioKo = useMemo(
    () => buildInicioKnockoutSchedule(groupMatches, groupPreds, inicioKoPreds),
    [groupMatches, groupPreds, inicioKoPreds],
  )

  const filledGroup = countFilledMatches(groupPreds, groupMatches)
  const filledKo = Object.keys(inicioKoPreds).filter(
    id => inicioKoPreds[id]?.home != null || inicioKoPreds[id]?.away != null,
  ).length

  if (!participant || !mounted) return null

  const isYou = participant.id === currentUserId
  const titleId = 'participant-preds-title'
  const primaryName = participant.team_name?.trim() || participant.name

  return createPortal(
    <div
      className="participant-preds-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="participant-preds-sheet">
        <header className="participant-preds-header">
          <ParticipantAvatar participant={participant} size={48} />
          <div className="participant-preds-header-text">
            <h2 id={titleId} className="participant-preds-title">
              Porra de {primaryName}
            </h2>
            <ParticipantDisplay
              participant={participant}
              isYou={isYou}
              showAdmin
              compact
            />
          </div>
          <button
            type="button"
            className="participant-preds-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="participant-preds-tabs" role="tablist" aria-label="Vista de la porra">
          {VIEWS.map(opt => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={view === opt.id}
              className={`participant-preds-tab${view === opt.id ? ' participant-preds-tab--active' : ''}`}
              onClick={() => setView(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="participant-preds-body">
          {view === 'groups' ? (
            filledGroup === 0 ? (
              <p className="dash-empty">Aún no ha rellenado la fase de grupos.</p>
            ) : (
              <GroupStandingsView
                matches={groupMatches}
                preds={groupPreds}
                locked
                onScore={() => {}}
                gridClassName="group-standings-grid--participant"
                knockoutMatches={knockoutMatches}
                publishedResults={publishedResults}
                apiMatches={apiMatches}
              />
            )
          ) : view === 'bonuses' ? (
            <BonusPredictionsView preds={bonusPreds} readOnly actuals={bonusActuals} />
          ) : inicioKo.schedule.length === 0 && filledKo === 0 ? (
            <p className="dash-empty">
              {inicioKo.error
                ? 'No se puede generar el cuadro: faltan resultados en grupos o la combinación de terceros no es válida.'
                : 'Aún no ha rellenado el cuadro de eliminatorias (fase Inicio).'}
            </p>
          ) : (
            <KnockoutBracketView
              matches={inicioKo.schedule}
              preds={inicioKoPreds}
              locked
              onScore={() => {}}
              onAdvance={() => {}}
              error={inicioKo.error}
              publishedResults={publishedResults}
              apiMatches={apiMatches}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
