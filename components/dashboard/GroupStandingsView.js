'use client'

import { useMemo } from 'react'
import { computeGroupStandings } from '../../lib/groupStandings'
import { computeBestThirdPlacesRanking } from '../../lib/bestThirdPlaces'
import TeamCrest from '../TeamCrest'
import MatchRow from './MatchRow'
import BestThirdPlacesTable from './BestThirdPlacesTable'

export default function GroupStandingsView({
  matches,
  preds,
  onScore,
  locked,
  matchRefs,
}) {
  const groups = useMemo(
    () => computeGroupStandings(matches, preds),
    [matches, preds],
  )

  const bestThirds = useMemo(
    () => computeBestThirdPlacesRanking(matches, preds),
    [matches, preds],
  )

  if (!groups.length) return null

  return (
    <div className="group-standings-grid">
      {groups.map(group => (
        <section key={group.id} className="group-standings-card">
          <header className="group-standings-header">{group.label}</header>

          <div className="group-standings-table-wrap">
            <table className="group-standings-table">
              <thead>
                <tr>
                  <th scope="col">Equipo</th>
                  <th scope="col" title="Puntos">Pts</th>
                  <th scope="col" title="Diferencia de goles">DG</th>
                  <th scope="col" title="Goles a favor">GF</th>
                  <th scope="col" title="Partidos jugados">PJ</th>
                </tr>
              </thead>
              <tbody>
                {group.teams.map((team, i) => (
                  <tr key={team.name} className={i < 2 ? 'group-standings-row--qualify' : ''}>
                    <td className="group-standings-team">
                      <TeamCrest src={team.crest} alt={team.name} size={18} />
                      <span>{team.name}</span>
                    </td>
                    <td>{team.pts}</td>
                    <td>{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
                    <td>{team.gf}</td>
                    <td>{team.pj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="group-standings-matches">
            {group.matches.map(m => (
              <MatchRow
                key={m.id}
                matchRef={el => { if (matchRefs) matchRefs.current[m.id] = el }}
                home={m.home}
                away={m.away}
                homeCrest={m.homeCrest}
                awayCrest={m.awayCrest}
                utcDate={m.utcDate}
                homeVal={preds[m.id]?.home ?? ''}
                awayVal={preds[m.id]?.away ?? ''}
                onHome={v => onScore(m.id, 'home', v)}
                onAway={v => onScore(m.id, 'away', v)}
                locked={locked}
                compact
                showMatchDate
              />
            ))}
          </div>
        </section>
      ))}

      <BestThirdPlacesTable
        rows={bestThirds.rows}
        combinationKey={bestThirds.combinationKey}
      />
    </div>
  )
}
