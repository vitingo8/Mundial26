'use client'

import { useMemo } from 'react'
import { computeGroupStandings } from '../../lib/groupStandings'
import { finishedGroupScoresFromApi, getApiMatchDisplayScore, indexApiMatches } from '../../lib/apiMatchScores'
import TeamCrest from '../TeamCrest'
import LiveResultRow from './LiveResultRow'

export default function LiveGroupStandingsView({
  matches,
  apiMatches = [],
  userPreds = {},
  onGoToPrediction,
  onOpenMatch,
}) {
  const rawById = useMemo(() => indexApiMatches(apiMatches), [apiMatches])
  const officialScores = useMemo(
    () => finishedGroupScoresFromApi(apiMatches),
    [apiMatches],
  )
  const groups = useMemo(
    () => computeGroupStandings(matches, officialScores),
    [matches, officialScores],
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
                  <th scope="col" className="gs-col-dg" title="Diferencia de goles">DG</th>
                  <th scope="col" className="gs-col-gf" title="Goles a favor">GF</th>
                  <th scope="col" className="gs-col-pj" title="Partidos jugados">PJ</th>
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
                    <td className="gs-col-dg">{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
                    <td className="gs-col-gf">{team.gf}</td>
                    <td className="gs-col-pj">{team.pj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="group-standings-matches">
            {group.matches.map(m => {
              const raw = rawById[m.id]
              return (
                <LiveResultRow
                  key={m.id}
                  home={m.home}
                  away={m.away}
                  homeCrest={m.homeCrest}
                  awayCrest={m.awayCrest}
                  utcDate={m.utcDate}
                  score={getApiMatchDisplayScore(raw)}
                  status={raw?.status}
                  userPred={userPreds[m.id]}
                  compact
                  showMatchDate
                  onGoToPrediction={onGoToPrediction ? () => onGoToPrediction(m.id) : undefined}
                  onOpenDetail={onOpenMatch ? () => onOpenMatch(m) : undefined}
                />
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
