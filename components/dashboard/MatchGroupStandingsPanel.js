'use client'

import { useMemo } from 'react'
import { computeGroupStandings } from '../../lib/groupStandings'
import {
  getApiMatchDisplayScore,
  groupScoresFromApi,
  indexApiMatches,
  normalizeGroupKey,
} from '../../lib/apiMatchScores'
import TeamCrest from '../TeamCrest'
import LiveResultRow from './LiveResultRow'

export default function MatchGroupStandingsPanel({
  groupKey,
  groupMatches = [],
  apiMatches = [],
  userPreds = {},
  highlightMatchId,
}) {
  const normalizedKey = normalizeGroupKey(groupKey)
  const groupOnlyMatches = useMemo(
    () => groupMatches.filter(m => normalizeGroupKey(m.group) === normalizedKey),
    [groupMatches, normalizedKey],
  )

  const rawById = useMemo(() => indexApiMatches(apiMatches), [apiMatches])
  const officialScores = useMemo(
    () => groupScoresFromApi(apiMatches),
    [apiMatches],
  )

  const group = useMemo(() => {
    const groups = computeGroupStandings(groupOnlyMatches, officialScores)
    return groups.find(g => normalizeGroupKey(g.id) === normalizedKey) || groups[0] || null
  }, [groupOnlyMatches, officialScores, normalizedKey])

  if (!normalizedKey || !group) {
    return (
      <p className="match-detail-hint">
        Clasificación del grupo no disponible para este partido.
      </p>
    )
  }

  return (
    <section className="match-detail-section match-detail-section--group-table">
      <h3 className="match-detail-section-title">Grupo {normalizedKey}</h3>
      <div className="group-standings-card group-standings-card--match-detail">
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
                    <span className="group-standings-team-name">{team.name}</span>
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

        <div className="group-standings-matches group-standings-matches--match-detail group-standings-matches--table">
          {group.matches.map(m => {
            const raw = rawById[m.id]
            const isCurrent = highlightMatchId != null && String(m.id) === String(highlightMatchId)
            return (
              <div
                key={m.id}
                className={isCurrent ? 'match-detail-group-match--current' : undefined}
              >
                <LiveResultRow
                  home={m.home}
                  away={m.away}
                  homeCrest={m.homeCrest}
                  awayCrest={m.awayCrest}
                  utcDate={m.utcDate}
                  score={getApiMatchDisplayScore(raw)}
                  status={raw?.status}
                  liveMinute={raw?.liveTime?.short || (raw?.minute != null ? `${raw.minute}'` : null)}
                  userPred={userPreds[m.id]}
                  denseTable
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
