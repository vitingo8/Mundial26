import { KnockoutBracketError } from './errors'
import { knockoutMessages as msg } from './messages'
import { findQualifiedByGroup } from './qualification'
import type {
  GroupLetter,
  QualifiedTeams,
  Team,
  ThirdPlaceMatchAssignments,
} from './types'

const PLACE_GROUP_RE = /^([123])([A-L])$/
const THIRD_PLACE_RE = /^3([A-L](?:\/[A-L])*)$/

export function parseAllowedThirdGroups(sourceCode: string): GroupLetter[] {
  const m = sourceCode.match(THIRD_PLACE_RE)
  if (!m) return []
  return m[1].split('/') as GroupLetter[]
}

export function isThirdPlaceSource(sourceCode: string): boolean {
  return THIRD_PLACE_RE.test(sourceCode)
}

export function resolveTeamSource(
  sourceCode: string,
  qualifiedTeams: QualifiedTeams,
  thirdPlaceAssignments: ThirdPlaceMatchAssignments,
  matchNumber: number,
): { team: Team; resolvedGroup?: GroupLetter } {
  const thirdMatch = sourceCode.match(THIRD_PLACE_RE)
  if (thirdMatch) {
    const allowed = parseAllowedThirdGroups(sourceCode)
    const assigned = thirdPlaceAssignments[matchNumber]
    if (!assigned) {
      throw new KnockoutBracketError(msg.missingAssignmentForSource(matchNumber, sourceCode))
    }
    if (!allowed.includes(assigned)) {
      throw new KnockoutBracketError(
        msg.groupNotAllowed(matchNumber, assigned, sourceCode, allowed.join('/')),
      )
    }
    const entry = findQualifiedByGroup(qualifiedTeams, assigned, 3)
    return { team: entry.team, resolvedGroup: assigned }
  }

  const direct = sourceCode.match(PLACE_GROUP_RE)
  if (!direct) {
    throw new KnockoutBracketError(msg.invalidSource(sourceCode))
  }

  const place = Number(direct[1]) as 1 | 2 | 3
  const group = direct[2] as GroupLetter
  const entry = findQualifiedByGroup(qualifiedTeams, group, place)
  return { team: entry.team, resolvedGroup: group }
}
