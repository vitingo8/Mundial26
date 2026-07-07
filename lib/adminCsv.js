import { displayTeamName } from './teamNamesEs.js'
import { inicioKoMatchId, knockoutRealKoMatchId } from './knockoutBridge.js'
import { inferKnockoutAdvancesFromApiMatch, isKnockoutScoreDraw } from './knockoutAdvances.js'
import { getRegulationTimeScore } from './knockoutRegulationScore.js'

/** Parsea CSV/TSV de resultados: id,home,away o home,away,gl, gv */
export function parseResultsPaste(text, groupMatches = []) {
  const lines = (text || '').trim().split(/\r?\n/).filter(Boolean)
  const out = {}
  const byTeams = new Map()
  groupMatches.forEach(m => {
    const k = `${(m.home || '').toLowerCase()}|${(m.away || '').toLowerCase()}`
    byTeams.set(k, m.id)
  })

  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map(p => p.trim())
    if (parts.length >= 4 && !isNaN(Number(parts[2])) && !isNaN(Number(parts[3]))) {
      const home = parts[0]
      const away = parts[1]
      const id = byTeams.get(`${home.toLowerCase()}|${away.toLowerCase()}`) || parts[0]
      if (groupMatches.find(m => String(m.id) === String(id))) {
        out[id] = { home: Number(parts[2]), away: Number(parts[3]) }
      } else if (byTeams.has(`${home.toLowerCase()}|${away.toLowerCase()}`)) {
        out[byTeams.get(`${home.toLowerCase()}|${away.toLowerCase()}`)] = {
          home: Number(parts[2]),
          away: Number(parts[3]),
        }
      }
      continue
    }
    if (parts.length >= 3) {
      const id = parts[0]
      const home = Number(parts[1])
      const away = Number(parts[2])
      if (!isNaN(home) && !isNaN(away)) out[id] = { home, away }
    }
  }
  return out
}

export function finishedMatchesToResults(matches) {
  const group = {}
  const knockout = {}
  for (const m of matches || []) {
    if (m.status !== 'FINISHED') continue
    const home = m.score?.fullTime?.home
    const away = m.score?.fullTime?.away
    if (home == null || away == null) continue
    const entry = { home, away }
    if (m.stage !== 'GROUP_STAGE') {
      const reg = getRegulationTimeScore(m)
      if (reg) {
        entry.home = reg.home
        entry.away = reg.away
      }
      if (isKnockoutScoreDraw(entry)) {
        const advances = inferKnockoutAdvancesFromApiMatch(m)
        if (advances) entry.advances = advances
      }
      const matchNumber = m.matchNumber
      if (matchNumber != null) entry.matchNumber = matchNumber
      const homeTeam = displayTeamName(m.homeTeam?.name || m.homeTeam?.shortName)
      const awayTeam = displayTeamName(m.awayTeam?.name || m.awayTeam?.shortName)
      if (homeTeam) entry.homeTeam = homeTeam
      if (awayTeam) entry.awayTeam = awayTeam
      knockout[String(m.id)] = entry
      if (matchNumber != null) {
        knockout[inicioKoMatchId(matchNumber)] = entry
        knockout[knockoutRealKoMatchId(matchNumber)] = entry
      }
      continue
    }
    group[String(m.id)] = entry
  }
  return { group, knockout }
}
