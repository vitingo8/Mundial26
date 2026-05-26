import { computeGroupStandings } from './groupStandings.js'
import {
  standingsBlocksToGroupsInput,
  getQualifiedTeams,
  rankThirdPlacedTeams,
  buildThirdPlaceCombinationKey,
} from './knockout/dist/index.js'

/**
 * Ranking de los 12 terceros según criterios FIFA; los 8 primeros clasifican.
 */
export function computeBestThirdPlacesRanking(groupMatches, scoresMap = {}) {
  const blocks = computeGroupStandings(groupMatches, scoresMap)
  if (blocks.length < 12) {
    return { rows: [], combinationKey: null, complete: false }
  }

  try {
    const groups = standingsBlocksToGroupsInput(blocks)
    const { thirdPlaced, bestThirdPlaced } = getQualifiedTeams(groups)
    const ranked = rankThirdPlacedTeams(thirdPlaced)
    const combinationKey = buildThirdPlaceCombinationKey(bestThirdPlaced)

    return {
      rows: ranked.map((e, i) => ({
        rank: i + 1,
        group: e.group,
        name: e.team.name,
        crest: e.team.crest ?? null,
        pts: e.standing.pts,
        gd: e.standing.gd,
        gf: e.standing.gf ?? 0,
        pj: e.standing.pj ?? 0,
        qualifies: i < 8,
      })),
      combinationKey,
      complete: true,
    }
  } catch {
    return { rows: [], combinationKey: null, complete: false }
  }
}
