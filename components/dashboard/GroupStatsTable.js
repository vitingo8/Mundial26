'use client'

import ParticipantDisplay from '../ParticipantDisplay'
import { SCORING_COLUMN_LIMITS, formatPtsOfMax } from '../../lib/scoringMaximum.js'

const LIMITS = SCORING_COLUMN_LIMITS

/** Columnas agrupadas por fase (sin duplicar totales mezclados). */
const PHASE_GROUPS = [
  {
    id: 'base',
    label: null,
    columns: [
      { key: 'rank', label: '#', title: 'Posición', kind: 'rank' },
      { key: 'name', label: 'Jugador', title: 'Participante', kind: 'name' },
      {
        key: 'total',
        label: 'Total',
        title: `Suma de todas las fases (máx. ${LIMITS.total})`,
        limitKey: 'total',
        emphasize: true,
      },
    ],
  },
  {
    id: 'inicio',
    label: 'Inicio',
    columns: [
      {
        key: 'inicioGepPts',
        label: 'G/E/P',
        title: `1X2 en grupos y KO previsto (máx. ${LIMITS.inicioGepPts})`,
        limitKey: 'inicioGepPts',
      },
      {
        key: 'inicioResultadoPts',
        label: 'Res.',
        title: `Marcador exacto en Inicio (máx. ${LIMITS.inicioResultadoPts})`,
        limitKey: 'inicioResultadoPts',
      },
      {
        key: 'inicioAdvancePts',
        label: 'Pasa',
        title: `Quién pasa en KO previsto (máx. ${LIMITS.inicioAdvancePts})`,
        limitKey: 'inicioAdvancePts',
      },
      {
        key: 'qualificationWeighted',
        label: 'Clas.',
        title: `Clasificados a dieciseisavos (máx. ${LIMITS.qualificationPts})`,
        limitKey: 'qualificationPts',
      },
    ],
  },
  {
    id: 'elim',
    label: 'Eliminatorias',
    columns: [
      {
        key: 'knockoutGepPts',
        label: 'G/E/P',
        title: `1X2 en eliminatorias reales (máx. ${LIMITS.knockoutGepPts})`,
        limitKey: 'knockoutGepPts',
      },
      {
        key: 'knockoutResultadoPts',
        label: 'Res.',
        title: `Marcador exacto en eliminatorias (máx. ${LIMITS.knockoutResultadoPts})`,
        limitKey: 'knockoutResultadoPts',
      },
      {
        key: 'knockoutAdvancePts',
        label: 'Pasa',
        title: `Quién pasa en eliminatorias (máx. ${LIMITS.knockoutAdvancePts})`,
        limitKey: 'knockoutAdvancePts',
      },
    ],
  },
  {
    id: 'esp',
    label: 'Especiales',
    columns: [
      {
        key: 'especialPts',
        label: 'Esp.',
        title: `Goleador, portero y asistente (máx. ${LIMITS.especialPts})`,
        limitKey: 'especialPts',
      },
      {
        key: 'mvpPts',
        label: 'MVP',
        title: `MVP del torneo (máx. ${LIMITS.mvpPts})`,
        limitKey: 'mvpPts',
      },
    ],
  },
]

const FLAT_COLUMNS = PHASE_GROUPS.flatMap(g =>
  g.columns.map(col => ({ ...col, phase: g.id })),
)

function PtsCell({ value, max, emphasize }) {
  const display = formatPtsOfMax(value, max)
  const [got, cap] = display.split('/')
  return (
    <span className={`stats-table-pts${emphasize ? ' stats-table-pts--total' : ''}`}>
      <span className="stats-table-pts-got">{got}</span>
      <span className="stats-table-pts-cap">/{cap}</span>
    </span>
  )
}

export default function GroupStatsTable({ rows, currentUserId, onViewParticipant }) {
  if (!rows.length) {
    return <p className="dash-empty">Sin participantes todavía</p>
  }

  return (
    <div className="stats-table-wrap">
      <div className="stats-table-scroll" role="region" aria-label="Tabla de puntuación" tabIndex={0}>
        <table className="stats-table stats-table--compact stats-table--limits stats-table--phases">
          <thead>
            <tr className="stats-table-phase-row">
              {PHASE_GROUPS.map(group => (
                <th
                  key={group.id}
                  colSpan={group.columns.length}
                  scope="colgroup"
                  className={`stats-table-phase-head stats-table-phase-head--${group.id}`}
                >
                  {group.label && (
                    <span className="stats-table-phase-label">{group.label}</span>
                  )}
                </th>
              ))}
            </tr>
            <tr>
              {FLAT_COLUMNS.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  title={col.title}
                  className={`stats-table-col-head stats-table-col-head--${col.phase}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isYou = row.id === currentUserId
              const canView = typeof onViewParticipant === 'function'
              const label = row.team_name?.trim() || row.name
              return (
                <tr
                  key={row.id}
                  className={`stats-table-row${isYou ? ' stats-table-row--you' : ''}${row.rank === 1 ? ' stats-table-row--leader' : ''}${canView ? ' stats-table-row--clickable' : ''}`}
                  onClick={canView ? () => onViewParticipant(row) : undefined}
                  onKeyDown={canView ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewParticipant(row) } } : undefined}
                  tabIndex={canView ? 0 : undefined}
                  role={canView ? 'button' : undefined}
                  aria-label={canView ? `Ver porra de ${label}` : undefined}
                >
                  {FLAT_COLUMNS.map(col => {
                    if (col.kind === 'rank') {
                      return (
                        <td key={col.key} className="stats-table-rank stats-table-cell--base">
                          {row.rank}
                        </td>
                      )
                    }
                    if (col.kind === 'name') {
                      return (
                        <td key={col.key} className="stats-table-name stats-table-cell--base">
                          <ParticipantDisplay
                            participant={row}
                            isYou={isYou}
                            showAdmin
                            compact
                            showAvatar
                            avatarSize={32}
                          />
                        </td>
                      )
                    }
                    const max = LIMITS[col.limitKey]
                    const value = row[col.key] ?? 0
                    return (
                      <td
                        key={col.key}
                        className={`stats-table-num stats-table-cell--${col.phase}${col.emphasize ? ' stats-table-num--total' : ''}`}
                        title={`${value} de ${max} pts`}
                      >
                        <PtsCell value={value} max={max} emphasize={col.emphasize} />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="stats-table-legend stats-table-legend--phases" aria-hidden="true">
        <span className="stats-table-legend-swatch stats-table-legend-swatch--inicio">Inicio</span>
        <span className="stats-table-legend-swatch stats-table-legend-swatch--elim">Eliminatorias</span>
        <span className="stats-table-legend-swatch stats-table-legend-swatch--esp">Especiales</span>
      </div>
      <p className="stats-table-legend">
        Cada celda: puntos / máximo de esa fase. Sin columnas duplicadas entre Inicio y Eliminatorias.
      </p>
    </div>
  )
}
