import { teamsMatch } from './fifaMatchNumbers.js'
import { GROUP_LETTERS, emptyGroupMap } from './groupQualificationScoring.js'
import { computeGroupStandings } from './groupStandings.js'
import { isGroupMatchFinished } from './groupStageCompletion.js'

const SCORE_OUTCOMES = [
  [1, 0],
  [0, 0],
  [0, 1],
  [3, 0],
  [0, 3],
  [2, 2],
]

function normalizeGroupKey(group) {
  if (!group) return null
  return String(group).replace(/^GROUP_/i, '').toUpperCase()
}

function indexApiMatches(apiMatches) {
  return Object.fromEntries((apiMatches || []).map(m => [String(m.id), m]))
}

function buildFinishedScoresMap(groupMatches, apiIndex) {
  /** @type {Record<string, { home: number, away: number }>} */
  const scores = {}
  for (const m of groupMatches) {
    const api = apiIndex[String(m.id)]
    if (!isGroupMatchFinished(api)) continue
    scores[m.id] = {
      home: api.score.fullTime.home,
      away: api.score.fullTime.away,
    }
  }
  return scores
}

function getGroupBlock(groupLetter, groupMatches, apiMatches) {
  const letter = normalizeGroupKey(groupLetter)
  const inGroup = (groupMatches || []).filter(m => normalizeGroupKey(m.group) === letter)
  if (!inGroup.length) return null
  const apiIndex = indexApiMatches(apiMatches)
  const finishedScores = buildFinishedScoresMap(inGroup, apiIndex)
  const remaining = inGroup.filter(m => !finishedScores[m.id])
  return { letter, matches: inGroup, finishedScores, remaining }
}

function* enumerateScoreMaps(baseScores, remainingMatches) {
  if (!remainingMatches.length) {
    yield baseScores
    return
  }

  const [first, ...rest] = remainingMatches
  for (const [home, away] of SCORE_OUTCOMES) {
    for (const map of enumerateScoreMaps(
      { ...baseScores, [first.id]: { home, away } },
      rest,
    )) {
      yield map
    }
  }
}

function rankByTeamName(sortedTeams) {
  /** @type {Record<string, number>} */
  const ranks = {}
  sortedTeams.forEach((team, index) => {
    ranks[team.name] = index + 1
  })
  return ranks
}

/**
 * Posiciones 1–4 matemáticamente fijas aunque queden partidos.
 * @returns {Record<number, string|null>}
 */
export function getMathematicallyLockedPositions(groupLetter, groupMatches = [], apiMatches = []) {
  const block = getGroupBlock(groupLetter, groupMatches, apiMatches)
  const empty = { 1: null, 2: null, 3: null, 4: null }
  if (!block) return empty

  const { matches, finishedScores, remaining } = block
  const teamNames = [...new Set(matches.flatMap(m => [m.home, m.away]))]
  if (!teamNames.length) return empty

  /** @type {Record<string, number[]>} */
  const ranksByTeam = Object.fromEntries(teamNames.map(name => [name, []]))

  for (const scoresMap of enumerateScoreMaps(finishedScores, remaining)) {
    const [groupBlock] = computeGroupStandings(matches, scoresMap)
    const ranks = rankByTeamName(groupBlock?.teams ?? [])
    for (const name of teamNames) {
      ranksByTeam[name].push(ranks[name] ?? 99)
    }
  }

  const out = { ...empty }
  for (const name of teamNames) {
    const ranks = ranksByTeam[name]
    if (!ranks.length) continue
    const unique = new Set(ranks)
    if (unique.size !== 1) continue
    const position = [...unique][0]
    if (position >= 1 && position <= 4) out[position] = name
  }

  return out
}

function pickFotmobTeamName(candidate, fotmobRow = {}) {
  if (!candidate) return null
  for (const pos of [1, 2, 3]) {
    const name = fotmobRow[pos]
    if (name && teamsMatch(name, candidate)) return name
  }
  return candidate
}

/**
 * Plazas de bracket: grupos cerrados → FotMob; abiertos → solo 1.º/2.º matemáticamente fijos.
 */
export function buildBracketQualifiersFromStandings(
  fotmobByGroup = {},
  completedGroups,
  groupMatches = [],
  apiMatches = [],
) {
  const completed = completedGroups instanceof Set ? completedGroups : new Set(completedGroups || [])
  const out = emptyGroupMap()

  for (const letter of GROUP_LETTERS) {
    const fotmobRow = fotmobByGroup[letter] || {}
    if (completed.has(letter)) {
      out[letter] = {
        1: fotmobRow[1] ?? null,
        2: fotmobRow[2] ?? null,
        3: fotmobRow[3] ?? null,
      }
      continue
    }

    const locked = getMathematicallyLockedPositions(letter, groupMatches, apiMatches)
    out[letter] = {
      1: pickFotmobTeamName(locked[1], fotmobRow),
      2: pickFotmobTeamName(locked[2], fotmobRow),
      3: null,
    }
  }

  return out
}
