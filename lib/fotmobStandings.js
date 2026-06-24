import { teamsMatch, normalizeTeamName } from './fifaMatchNumbers.js'
import { fotmobFetch, FOTMOB_WC_LEAGUE_ID } from './fotmob.js'
import { buildTeamToGroupLetterMap } from './groupQualificationScoring.js'

export const GROUP_LETTERS = /** @type {const} */ (
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
)

/** Verde FotMob: clasificación confirmada (top 2 o mejor tercero en el top 8). */
export const FOTMOB_QUALIFIED_COLOR = '#2AD572'

const BEST_THIRDS_TITLE = 'best 3rd placed teams'

function emptyGroupMap() {
  return Object.fromEntries(GROUP_LETTERS.map(g => [g, { 1: null, 2: null, 3: null }]))
}

function parseFotmobGroupLetter(leagueName) {
  const m = String(leagueName || '').match(/Grp\.?\s*([A-L])/i)
  return m ? m[1].toUpperCase() : null
}

function countResolvedSlots(byGroup) {
  let n = 0
  for (const letter of GROUP_LETTERS) {
    const row = byGroup[letter] || {}
    if (row[1]) n += 1
    if (row[2]) n += 1
    if (row[3]) n += 1
  }
  return n
}

function resolveTeamGroupLetter(teamName, teamToGroup) {
  const key = normalizeTeamName(teamName)
  if (!key) return null
  if (teamToGroup.has(key)) return teamToGroup.get(key)
  for (const [mapKey, letter] of teamToGroup.entries()) {
    if (teamsMatch(mapKey, teamName)) return letter
  }
  return null
}

function applyBestThirdQualifiers(byGroup, bestThirdRows, teamToGroup) {
  for (const row of bestThirdRows) {
    if (!row.qualifies || !row.name) continue
    const group = resolveTeamGroupLetter(row.name, teamToGroup)
    if (!group || !GROUP_LETTERS.includes(group)) continue
    if (!byGroup[group][3]) byGroup[group][3] = row.name
  }
}

/**
 * Convierte la pestaña «table» de FotMob en clasificados reales por grupo (1.º, 2.º, 3.º mejor tercero).
 * @param {object} apiResponse — respuesta de /api/data/leagues?id=77&tab=table
 * @param {object[]} [groupMatches] — catálogo de grupos para ubicar el grupo de cada mejor tercero
 */
export function transformFotmobStandings(apiResponse, groupMatches = []) {
  const byGroup = emptyGroupMap()
  const tables = apiResponse?.table?.[0]?.data?.tables || []
  const teamToGroup = buildTeamToGroupLetterMap(groupMatches)
  const bestThirdRows = []

  for (const block of tables) {
    const title = String(block.leagueName || '').trim()
    const rows = block.table?.all || []

    if (title.toLowerCase().includes(BEST_THIRDS_TITLE)) {
      for (const row of rows) {
        bestThirdRows.push({
          rank: row.idx,
          name: row.name,
          qualifies: row.qualColor === FOTMOB_QUALIFIED_COLOR,
          pts: row.pts,
          played: row.played,
        })
      }
      continue
    }

    const letter = parseFotmobGroupLetter(title)
    if (!letter || !GROUP_LETTERS.includes(letter)) continue

    const first = rows.find(r => r.idx === 1)
    const second = rows.find(r => r.idx === 2)
    if (first?.name) byGroup[letter][1] = first.name
    if (second?.name) byGroup[letter][2] = second.name
  }

  applyBestThirdQualifiers(byGroup, bestThirdRows, teamToGroup)

  const resolvedCount = countResolvedSlots(byGroup)
  return {
    byGroup,
    bestThirds: bestThirdRows,
    resolvedCount,
    ready: resolvedCount > 0,
    source: 'fotmob',
  }
}

export async function fetchFotmobGroupStandings(groupMatches = []) {
  const data = await fotmobFetch('/api/data/leagues', {
    id: String(FOTMOB_WC_LEAGUE_ID),
    tab: 'table',
  })
  return transformFotmobStandings(data, groupMatches)
}
