/**
 * Calcula clasificación por grupo a partir de marcadores (predicciones o resultados).
 * @param {Array<{ id, group, home, away, homeCrest?, awayCrest? }>} groupMatches
 * @param {Record<string, { home?: number, away?: number }>} scoresMap
 */
export function computeGroupStandings(groupMatches, scoresMap = {}) {
  const groups = {}

  for (const m of groupMatches) {
    const g = m.group
    if (!g) continue
    if (!groups[g]) groups[g] = { id: g, teams: {}, matches: [] }
    groups[g].matches.push(m)
    for (const [team, crestKey] of [[m.home, 'homeCrest'], [m.away, 'awayCrest']]) {
      if (!groups[g].teams[team]) {
        groups[g].teams[team] = {
          name: team,
          crest: m[crestKey],
          pj: 0,
          gf: 0,
          gc: 0,
          dg: 0,
          pts: 0,
        }
      } else if (!groups[g].teams[team].crest && m[crestKey]) {
        groups[g].teams[team].crest = m[crestKey]
      }
    }
  }

  for (const m of groupMatches) {
    const pred = scoresMap[m.id]
    if (pred?.home == null || pred?.away == null) continue
    const home = Number(pred.home)
    const away = Number(pred.away)
    if (Number.isNaN(home) || Number.isNaN(away)) continue

    const g = groups[m.group]
    if (!g) continue
    const ht = g.teams[m.home]
    const at = g.teams[m.away]
    if (!ht || !at) continue

    ht.pj += 1
    at.pj += 1
    ht.gf += home
    ht.gc += away
    at.gf += away
    at.gc += home

    if (home > away) {
      ht.pts += 3
    } else if (home < away) {
      at.pts += 3
    } else {
      ht.pts += 1
      at.pts += 1
    }
  }

  return Object.keys(groups)
    .sort()
    .map(gid => {
      const g = groups[gid]
      const teams = Object.values(g.teams).map(t => ({
        ...t,
        dg: t.gf - t.gc,
      }))
      teams.sort((a, b) =>
        b.pts - a.pts
        || b.dg - a.dg
        || b.gf - a.gf
        || a.name.localeCompare(b.name, 'es'),
      )
      return {
        id: gid,
        label: `Grupo ${gid}`,
        teams,
        matches: g.matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)),
      }
    })
}
