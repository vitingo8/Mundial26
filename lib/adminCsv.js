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
      const winner = m.score?.winner
      if (winner === 'HOME_TEAM') entry.advances = 'home'
      else if (winner === 'AWAY_TEAM') entry.advances = 'away'
    }
    if (m.stage === 'GROUP_STAGE') group[String(m.id)] = entry
    else knockout[String(m.id)] = entry
  }
  return { group, knockout }
}
