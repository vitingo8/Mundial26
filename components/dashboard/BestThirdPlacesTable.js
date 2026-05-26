'use client'

import TeamCrest from '../TeamCrest'

export default function BestThirdPlacesTable({ rows, combinationKey }) {
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
              <th scope="col">#</th>
              <th scope="col">Grupo</th>
              <th scope="col">Equipo</th>
              <th scope="col" title="Puntos">Pts</th>
              <th scope="col" title="Diferencia de goles">DG</th>
              <th scope="col" title="Goles a favor">GF</th>
              <th scope="col" title="Partidos jugados">PJ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.group}
                className={row.qualifies ? 'best-thirds-row--in' : 'best-thirds-row--out'}
              >
                <td className="best-thirds-rank">{row.rank}</td>
                <td className="best-thirds-group">{row.group}</td>
                <td className="best-thirds-team">
                  <TeamCrest src={row.crest} alt={row.name} size={18} />
                  <span>{row.name}</span>
                </td>
                <td>{row.pts}</td>
                <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                <td>{row.gf}</td>
                <td>{row.pj}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="best-thirds-legend">
        Filas resaltadas = clasifican como mejor tercero · Criterio: puntos → DG → GF
      </p>
    </section>
  )
}
