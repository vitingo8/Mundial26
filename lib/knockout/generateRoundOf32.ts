import { KnockoutBracketError } from './errors'
import { knockoutMessages as msg } from './messages'
import {
  buildThirdPlaceCombinationKey,
  getQualifiedTeams,
  validateGroupsInput,
} from './qualification'
import { isThirdPlaceSource, parseAllowedThirdGroups, resolveTeamSource } from './resolveTeamSource'
import type {
  BracketMatch,
  GeneratedKnockoutMatch,
  GeneratedRoundOf32,
  GroupLetter,
  GroupsInput,
  ThirdPlaceCombinationMap,
  ThirdPlaceMatchAssignments,
} from './types'

function validateThirdPlaceAssignments(
  combinationKey: string,
  assignments: ThirdPlaceMatchAssignments,
  bracketMap: BracketMatch[],
  bestThirdGroups: Set<GroupLetter>,
): void {
  const usedThirdGroups = new Set<GroupLetter>()

  for (const slot of bracketMap) {
    for (const side of [slot.home, slot.away] as const) {
      if (!isThirdPlaceSource(side)) continue

      const allowed = parseAllowedThirdGroups(side)
      const assigned = assignments[slot.match]
      if (!assigned) {
        throw new KnockoutBracketError(
          msg.missingAssignmentForMatch(slot.match, combinationKey),
        )
      }
      if (!allowed.includes(assigned)) {
        throw new KnockoutBracketError(
          msg.groupNotAllowed(slot.match, assigned, side, allowed.join('/')),
        )
      }
      if (!bestThirdGroups.has(assigned)) {
        throw new KnockoutBracketError(msg.groupNotAmongBestThirds(slot.match, assigned))
      }
      if (usedThirdGroups.has(assigned)) {
        throw new KnockoutBracketError(msg.thirdUsedTwice(assigned, combinationKey))
      }
      usedThirdGroups.add(assigned)
    }
  }
}

export function generateRoundOf32(
  groups: GroupsInput,
  bracketMap: BracketMatch[],
  thirdPlaceCombinationMap: ThirdPlaceCombinationMap,
): GeneratedRoundOf32 {
  validateGroupsInput(groups)

  if (!bracketMap.length) {
    throw new KnockoutBracketError(msg.bracketEmpty)
  }

  const qualified = getQualifiedTeams(groups)
  const combinationKey = buildThirdPlaceCombinationKey(qualified.bestThirdPlaced)

  const assignments = thirdPlaceCombinationMap[combinationKey]
  if (!assignments) {
    throw new KnockoutBracketError(msg.missingCombination(combinationKey))
  }

  const bestThirdGroups = new Set(
    qualified.bestThirdPlaced.map(e => e.group),
  )
  validateThirdPlaceAssignments(
    combinationKey,
    assignments,
    bracketMap,
    bestThirdGroups,
  )

  const matches: GeneratedKnockoutMatch[] = bracketMap.map(slot => {
    const homeResolved = resolveTeamSource(
      slot.home,
      qualified,
      assignments,
      slot.match,
    )
    const awayResolved = resolveTeamSource(
      slot.away,
      qualified,
      assignments,
      slot.match,
    )

    return {
      matchNumber: slot.match,
      homeTeam: homeResolved.team,
      awayTeam: awayResolved.team,
      homeSource: slot.home,
      awaySource: slot.away,
      homeResolvedGroup: homeResolved.resolvedGroup,
      awayResolvedGroup: awayResolved.resolvedGroup,
      venue: slot.venue,
    }
  })

  return {
    round: 'round_of_32',
    combinationKey,
    matches,
  }
}
