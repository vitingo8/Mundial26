'use client'

import TeamCrest from '../TeamCrest'
import { lookupQualificationPoints } from '../../lib/groupQualificationScoring.js'
import QualificationPtsBadge from './QualificationPtsBadge'

export default function BestThirdPlacesTable({ rows, combinationKey, qualificationByTeam }) {
  if (!rows.length) return null

  return (
    <section className="best-thirds-section" aria-labelledby="best-thirds-title">
      <header className="best-thirds-header">
        <h3 id="best-thirds-title" className="best-thirds-title">
          Mejores terceros
        </h3>
        <p className="best-thirds-hint">
          Los 8 primeros entran en dieciseisavos según la tabla FIFA de combinaciones.
          {combinationKey && (
            <span className="best-thirds-key"> Combinación activa: {combinationKey}</span>
          )}
        </p>
      </header>

      <div className="best-thirds-table-wrap">
        <table className="best-thirds-table">
          <thead>
            <tr>
              <th scope="col" className="bt-col-rank">#</th>
              <th scope="col" className="bt-col-group">Grupo</th>
              <th scope="col" className="bt-col-team">Equipo</th>
              <th scope="col" title="Puntos">Pts</th>
              <th scope="col" className="bt-col-dg" title="Diferencia de goles">DG</th>
              <th scope="col" className="bt-col-gf" title="Goles a favor">GF</th>
              <th scope="col" className="bt-col-pj" title="Partidos jugados">PJ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const qualEntry = lookupQualificationPoints(qualificationByTeam, row.name)
              return (
              <tr
                key={row.group}
                className={row.qualifies ? 'best-thirds-row--in' : 'best-thirds-row--out'}
              >
                <td className="best-thirds-rank">{row.rank}</td>
                <td className="best-thirds-group">{row.group}</td>
                <td className="best-thirds-team">
                  <TeamCrest src={row.crest} alt={row.name} size={18} />
                  <span className="best-thirds-team-name">{row.name}</span>
                  <QualificationPtsBadge entry={qualEntry} />
                </td>
                <td>{row.pts}</td>
                <td className="bt-col-dg">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                <td className="bt-col-gf">{row.gf}</td>
                <td className="bt-col-pj">{row.pj}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="best-thirds-legend">
        Filas resaltadas = clasifican como mejor tercero · Criterio: puntos → DG → GF
      </p>
    </section>
  )
}
