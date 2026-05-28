'use client'

import ParticipantDisplay from '../ParticipantDisplay'
import { SCORING_COLUMN_LIMITS, formatPtsOfMax } from '../../lib/scoringMaximum.js'

const LIMITS = SCORING_COLUMN_LIMITS

const COLUMNS = [
  { key: 'rank', label: '#', title: 'Posición', kind: 'rank' },
  { key: 'name', label: 'Jugador', title: 'Participante', kind: 'name' },
  {
    key: 'total',
    label: 'Total',
    title: `Puntos totales (máx. ${LIMITS.total})`,
    limitKey: 'total',
    emphasize: true,
  },
  {
    key: 'inicioPts',
    label: 'Inicio',
    title: `Grupos + KO previsto + clasificados (×60 %, máx. ${LIMITS.inicioPts})`,
    limitKey: 'inicioPts',
  },
  {
    key: 'knockoutPts',
    label: 'KO',
    title: `Eliminatorias reales (×40 %, máx. ${LIMITS.knockoutPts})`,
    limitKey: 'knockoutPts',
  },
  {
    key: 'gepPts',
    label: 'G/E/P',
    title: `1X2 acertado (máx. ${LIMITS.gepPts} ponderado)`,
    limitKey: 'gepPts',
  },
  {
    key: 'resultadoPts',
    label: 'Res.',
    title: `Marcador exacto (máx. ${LIMITS.resultadoPts} ponderado)`,
    limitKey: 'resultadoPts',
  },
  {
    key: 'advancePts',
    label: 'Pasa',
    title: `Quién pasa en empate KO (máx. ${LIMITS.advancePts})`,
    limitKey: 'advancePts',
  },
  {
    key: 'qualificationWeighted',
    label: 'Clas.',
    title: `Clasificados a dieciseisavos (×60 %, máx. ${LIMITS.qualificationPts})`,
    limitKey: 'qualificationPts',
  },
  {
    key: 'especialPts',
    label: 'Esp.',
    title: `Goleador, mejor portero y asistente (máx. ${LIMITS.especialPts})`,
    limitKey: 'especialPts',
  },
  {
    key: 'mvpPts',
    label: 'MVP',
    title: `MVP del torneo (máx. ${LIMITS.mvpPts})`,
    limitKey: 'mvpPts',
  },
]

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

function ScoringLimitsSummary() {
  const phases = [
    { label: 'Inicio (×60 %)', max: LIMITS.inicioPts, detail: '72 grupos + 32 KO previsto + clasificados' },
    { label: 'Eliminatorias (×40 %)', max: LIMITS.knockoutPts, detail: '32 partidos reales' },
    { label: 'Especiales + MVP', max: LIMITS.bonusPts, detail: 'Sin ponderar' },
  ]
  return (
    <div className="stats-table-summary" aria-label="Puntos máximos por fase">
      <p className="stats-table-summary-title">
        Techo del torneo: <strong>{LIMITS.total} pts</strong>
      </p>
      <ul className="stats-table-summary-phases">
        {phases.map(p => (
          <li key={p.label}>
            <span className="stats-table-summary-label">{p.label}</span>
            <span className="stats-table-summary-max">máx. {p.max}</span>
            <span className="stats-table-summary-detail">{p.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function GroupStatsTable({ rows, currentUserId, onViewParticipant }) {
  if (!rows.length) {
    return <p className="dash-empty">Sin participantes todavía</p>
  }

  return (
    <div className="stats-table-wrap">
      <ScoringLimitsSummary />
      <div className="stats-table-scroll" role="region" aria-label="Tabla de puntuación" tabIndex={0}>
        <table className="stats-table stats-table--compact stats-table--limits">
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} scope="col" title={col.title}>
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
                  {COLUMNS.map(col => {
                    if (col.kind === 'rank') {
                      return <td key={col.key} className="stats-table-rank">{row.rank}</td>
                    }
                    if (col.kind === 'name') {
                      return (
                        <td key={col.key} className="stats-table-name">
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
                        className={`stats-table-num${col.emphasize ? ' stats-table-num--total' : ''}`}
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
      <p className="stats-table-legend">
        Cada celda muestra puntos conseguidos / máximo. Inicio incluye grupos, clasificados a dieciseisavos
        y KO previsto (×0,6). G/E/P, Res. y Pasa mezclan Inicio y eliminatorias reales con su peso.
        Especiales y MVP cuentan al 100 %.
      </p>
    </div>
  )
}
