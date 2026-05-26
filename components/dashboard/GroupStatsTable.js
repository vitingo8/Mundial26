'use client'

import ParticipantDisplay from '../ParticipantDisplay'

const COLUMNS = [
  { key: 'rank', label: '#', title: 'Posición' },
  { key: 'name', label: 'Jugador', title: 'Participante' },
  { key: 'gepPts', label: 'G/E/P', title: '1X2 acertado (3 pts c/u)' },
  { key: 'resultadoPts', label: 'Resultado', title: 'Marcador exacto (+5 pts c/u)' },
  { key: 'especialPts', label: 'Especial', title: 'Goleador, portero y asistente' },
  { key: 'mvpPts', label: 'MVP', title: 'MVP del torneo' },
]

export default function GroupStatsTable({ rows, currentUserId, onViewParticipant }) {
  if (!rows.length) {
    return <p className="dash-empty">Sin participantes todavía</p>
  }

  return (
    <div className="stats-table-wrap">
      <div className="stats-table-scroll" role="region" aria-label="Tabla de puntuación" tabIndex={0}>
        <table className="stats-table stats-table--compact">
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
                  <td className="stats-table-rank">{row.rank}</td>
                  <td className="stats-table-name">
                    <ParticipantDisplay
                      participant={row}
                      isYou={isYou}
                      showAdmin
                      compact
                      showAvatar
                      avatarSize={32}
                    />
                  </td>
                  <td className="stats-table-num">{row.gepPts}</td>
                  <td className="stats-table-num">{row.resultadoPts}</td>
                  <td className="stats-table-num">{row.especialPts}</td>
                  <td className="stats-table-num">{row.mvpPts}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="stats-table-legend">
        G/E/P = 1X2 (3 pts) · Resultado = exacto (+5 pts) · Especial y MVP = predicciones especiales
      </p>
    </div>
  )
}
