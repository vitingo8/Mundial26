'use client'

import { useMemo } from 'react'
import { computeGroupStandings } from '../../lib/groupStandings'
import { computeBestThirdPlacesRanking } from '../../lib/bestThirdPlaces'
import {
  buildQualificationPointsByTeam,
  lookupQualificationPoints,
} from '../../lib/groupQualificationScoring.js'
import { indexApiMatches } from '../../lib/apiMatchScores'
import TeamCrest from '../TeamCrest'
import MatchRow from './MatchRow'
import BestThirdPlacesTable from './BestThirdPlacesTable'
import QualificationPtsBadge from './QualificationPtsBadge'

export default function GroupStandingsView({
  matches,
  preds,
  onScore,
  locked,
  matchRefs,
  gridClassName = '',
  publishedResults = {},
  knockoutMatches = [],
  apiMatches = [],
}) {
  const rawById = useMemo(() => indexApiMatches(apiMatches), [apiMatches])
  const groups = useMemo(
    () => computeGroupStandings(matches, preds),
    [matches, preds],
  )

  const bestThirds = useMemo(
    () => computeBestThirdPlacesRanking(matches, preds),
    [matches, preds],
  )

  const qualificationPts = useMemo(
    () =>
      buildQualificationPointsByTeam(
        { predictions: { group: preds } },
        { groupMatches: matches, knockoutMatches },
      ),
    [matches, preds, knockoutMatches],
  )

  if (!groups.length) return null

  const denseMatches = gridClassName.includes('participant')

  return (
    <div className={`group-standings-grid${gridClassName ? ` ${gridClassName}` : ''}`}>
      {qualificationPts.ready && (
        <p className="group-standings-qual-hint" role="note">
          Junto al equipo: <strong>+1</strong> si clasifica a dieciseisavos (API) y <strong>+2</strong> si
          además aciertas 1.º / 2.º / 3.º. Cuentan al 60&nbsp;% en el total del ranking.
        </p>
      )}
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
                {group.teams.map((team, i) => {
                  const qualEntry = lookupQualificationPoints(
                    qualificationPts.byTeam,
                    team.name,
                  )
                  return (
                  <tr key={team.name} className={i < 2 ? 'group-standings-row--qualify' : ''}>
                    <td className="group-standings-team">
                      <TeamCrest src={team.crest} alt={team.name} size={18} />
                      <span className="group-standings-team-name">{team.name}</span>
                      <QualificationPtsBadge entry={qualEntry} />
                    </td>
                    <td>{team.pts}</td>
                    <td className="gs-col-dg">{team.dg > 0 ? `+${team.dg}` : team.dg}</td>
                    <td className="gs-col-gf">{team.gf}</td>
                    <td className="gs-col-pj">{team.pj}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div
            className={`group-standings-matches${
              denseMatches ? ' group-standings-matches--table' : ' group-standings-matches--porra'
            }`}
          >
            {group.matches.map(m => (
              <MatchRow
                key={m.id}
                matchRef={el => { if (matchRefs) matchRefs.current[m.id] = el }}
                home={m.home}
                away={m.away}
                homeCrest={m.homeCrest}
                awayCrest={m.awayCrest}
                utcDate={m.utcDate}
                matchNumber={m.matchNumber}
                fifaMatchLabel={m.fifaMatchLabel}
                knockoutMatchupLabel={m.knockoutMatchupLabel}
                homeVal={preds[m.id]?.home ?? ''}
                awayVal={preds[m.id]?.away ?? ''}
                onHome={v => onScore(m.id, 'home', v)}
                onAway={v => onScore(m.id, 'away', v)}
                locked={locked}
                compact
                denseTable={denseMatches}
                showMatchDate={!denseMatches}
                publishedResult={publishedResults[m.id]}
                apiRaw={rawById[m.id]}
              />
            ))}
          </div>
        </section>
      ))}

      <BestThirdPlacesTable
        rows={bestThirds.rows}
        combinationKey={bestThirds.combinationKey}
        qualificationByTeam={qualificationPts.byTeam}
      />
    </div>
  )
}
