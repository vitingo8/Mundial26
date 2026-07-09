'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildPublishedResultsMap } from '../../lib/matchPointsDisplay'
import { migratePredictionMap } from '../../lib/matchIdMap'
import { normalizeInicioKoPreds, buildInicioKnockoutSchedule } from '../../lib/knockoutBridge'
import { buildInicioKnockoutScoringState } from '../../lib/inicioKnockoutScoring'
import { defaultParticipantSheetView } from '../../lib/defaultParticipantSheetView'
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

function resolveDefaultView(ctx) {
  return defaultParticipantSheetView(ctx)
}

export default function ParticipantPredictionsSheet({
  participant,
  group,
  groupMatches,
  knockoutMatches = [],
  bonusActuals = {},
  publishedResults = {},
  results = {},
  apiMatches = [],
  fotmobStandings = null,
  onClose,
  currentUserId,
}) {
  const viewContext = useMemo(
    () => ({
      groupPhase: group?.phase,
      group,
      apiMatches,
      groupMatches,
      groupResults: results?.group ?? {},
    }),
    [group, apiMatches, groupMatches, results?.group],
  )

  const [view, setView] = useState(() => resolveDefaultView(viewContext))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!participant) return
    setView(resolveDefaultView(viewContext))
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
  }, [participant?.id, viewContext, onClose])

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

  const inicioKnockoutScoring = useMemo(
    () => buildInicioKnockoutScoringState(
      { predictions: { group: groupPreds, inicioKnockout: inicioKoPreds } },
      {
        groupMatches,
        knockoutMatches,
        knockoutResults: results?.knockout,
        groupResults: results?.group,
        fotmobStandings,
        apiMatches,
      },
    ),
    [
      groupPreds,
      inicioKoPreds,
      groupMatches,
      knockoutMatches,
      results?.knockout,
      results?.group,
      fotmobStandings,
      apiMatches,
    ],
  )

  const sheetPublishedResults = useMemo(() => {
    const groupMap = buildPublishedResultsMap(results, 'group', groupMatches, group?.results_updated_at)
    const knockoutMap = buildPublishedResultsMap(
      results,
      'knockout',
      knockoutMatches,
      group?.results_updated_at,
    )
    return { ...groupMap, ...knockoutMap }
  }, [results, groupMatches, knockoutMatches, group?.results_updated_at])

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
      onClick={onClose}
    >
      <div
        className="participant-preds-sheet"
        onClick={e => e.stopPropagation()}
      >
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
                publishedResults={sheetPublishedResults}
                apiMatches={apiMatches}
                fotmobStandings={fotmobStandings}
                viewingParticipantPreds
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
              readOnly
              onScore={() => {}}
              onAdvance={() => {}}
              error={inicioKo.error}
              publishedResults={sheetPublishedResults}
              apiMatches={apiMatches}
              groupMatches={groupMatches}
              knockoutMatches={knockoutMatches}
              inicioKnockoutScoring={inicioKnockoutScoring}
              viewingParticipantPreds
              knockoutAdvance
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
