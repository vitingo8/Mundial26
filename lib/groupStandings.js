/**
 * Calcula clasificación por grupo a partir de marcadores (predicciones o resultados).
 * Desempate FIFA (fase de grupos): mini-liga entre empatados → DG/GF global.
 *
 * @param {Array<{ id, group, home, away, homeCrest?, awayCrest? }>} groupMatches
 * @param {Record<string, { home?: number, away?: number }>} scoresMap
 */

/** @typedef {{ pts: number, gf: number, gc: number, dg: number }} MiniStats */

/**
 * Estadísticas solo de partidos entre equipos del subconjunto empatado.
 * @param {string[]} teamNames
 * @param {Array<{ id, home, away }>} matches
 * @param {Record<string, { home?: number, away?: number }>} scoresMap
 * @returns {Record<string, MiniStats>}
 */
export function computeMiniStats(teamNames, matches, scoresMap) {
  const inSet = new Set(teamNames)
  /** @type {Record<string, MiniStats>} */
  const stats = {}
  for (const name of teamNames) {
    stats[name] = { pts: 0, gf: 0, gc: 0, dg: 0 }
  }

  for (const m of matches) {
    if (!inSet.has(m.home) || !inSet.has(m.away)) continue
    const pred = scoresMap[m.id]
    if (pred?.home == null || pred?.away == null) continue
    const home = Number(pred.home)
    const away = Number(pred.away)
    if (Number.isNaN(home) || Number.isNaN(away)) continue

    const ht = stats[m.home]
    const at = stats[m.away]
    ht.gf += home
    ht.gc += away
    at.gf += away
    at.gc += home

    if (home > away) ht.pts += 3
    else if (home < away) at.pts += 3
    else {
      ht.pts += 1
      at.pts += 1
    }
  }

  for (const name of teamNames) {
    stats[name].dg = stats[name].gf - stats[name].gc
  }
  return stats
}

/** Ordena equipos empatados a puntos con criterios FIFA. */
export function sortTeamsByFifaTiebreak(teams, matches, scoresMap) {
  if (teams.length <= 1) return [...teams]

  const names = teams.map(t => t.name)
  const mini = computeMiniStats(names, matches, scoresMap)

  return [...teams].sort((a, b) => {
    const ma = mini[a.name]
    const mb = mini[b.name]
    if (mb.pts !== ma.pts) return mb.pts - ma.pts
    if (mb.dg !== ma.dg) return mb.dg - ma.dg
    if (mb.gf !== ma.gf) return mb.gf - ma.gf
    if (b.dg !== a.dg) return b.dg - a.dg
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.name.localeCompare(b.name, 'es')
  })
}

/**
 * Clasificación final del grupo: bloques por puntos + desempate FIFA en cada bloque.
 * @param {Array<{ name: string, pts: number, gf: number, gc: number, dg: number }>} teams
 */
export function sortGroupTeams(teams, matches, scoresMap) {
  const byPts = new Map()
  for (const t of teams) {
    const list = byPts.get(t.pts) || []
    list.push(t)
    byPts.set(t.pts, list)
  }

  const ptLevels = [...byPts.keys()].sort((a, b) => b - a)
  const sorted = []
  for (const pts of ptLevels) {
    const block = byPts.get(pts)
    sorted.push(...sortTeamsByFifaTiebreak(block, matches, scoresMap))
  }
  return sorted
}

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
      const sorted = sortGroupTeams(teams, g.matches, scoresMap)
      return {
        id: gid,
        label: `Grupo ${gid}`,
        teams: sorted,
        matches: g.matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate)),
      }
    })
}
