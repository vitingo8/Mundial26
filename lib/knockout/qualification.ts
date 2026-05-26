import { KnockoutBracketError } from './errors'
import { knockoutMessages as msg } from './messages'
import {
  GROUP_LETTERS,
  type GroupLetter,
  type GroupStanding,
  type GroupsInput,
  type QualifiedEntry,
  type QualifiedTeams,
  type Team,
} from './types'

function toTeam(standing: GroupStanding): Team {
  return {
    name: standing.team,
    code: standing.code,
    crest: standing.crest,
  }
}

function entry(group: GroupLetter, standing: GroupStanding): QualifiedEntry {
  return { group, standing, team: toTeam(standing) }
}

function standingAt(standings: GroupStanding[], position: number): GroupStanding {
  const byPos = standings.find(s => s.position === position)
  if (byPos) return byPos
  const idx = position - 1
  if (standings[idx]) return { ...standings[idx], position }
  throw new KnockoutBracketError(
    msg.noStandingPosition(standings[0]?.group ?? '?', position),
  )
}

export function validateGroupsInput(groups: GroupsInput): void {
  const keys = Object.keys(groups).sort()
  if (keys.length !== 12) {
    throw new KnockoutBracketError(msg.expected12Groups(keys.length, keys.join(', ')))
  }
  for (const letter of GROUP_LETTERS) {
    if (!groups[letter]?.length) {
      throw new KnockoutBracketError(msg.missingGroup(letter))
    }
    if (groups[letter].length < 3) {
      throw new KnockoutBracketError(msg.groupMinTeams(letter, groups[letter].length))
    }
  }
}

export function getQualifiedTeams(groups: GroupsInput): QualifiedTeams {
  validateGroupsInput(groups)

  const winners: QualifiedEntry[] = []
  const runnersUp: QualifiedEntry[] = []
  const thirdPlaced: QualifiedEntry[] = []

  for (const letter of GROUP_LETTERS) {
    const standings = [...groups[letter]].sort((a, b) => a.position - b.position)
    winners.push(entry(letter, standingAt(standings, 1)))
    runnersUp.push(entry(letter, standingAt(standings, 2)))
    thirdPlaced.push(entry(letter, standingAt(standings, 3)))
  }

  const bestThirdPlaced = rankThirdPlacedTeams(thirdPlaced).slice(0, 8)

  if (bestThirdPlaced.length !== 8) {
    throw new KnockoutBracketError(msg.expected8Thirds(bestThirdPlaced.length))
  }

  return { winners, runnersUp, thirdPlaced, bestThirdPlaced }
}

export function rankThirdPlacedTeams(
  thirdPlacedTeams: QualifiedEntry[],
): QualifiedEntry[] {
  return [...thirdPlacedTeams].sort(compareThirdPlaced)
}

/** Criterios FIFA: puntos → DG → GF → fair play → desempate determinista (grupo). */
export function compareThirdPlaced(a: QualifiedEntry, b: QualifiedEntry): number {
  const sa = a.standing
  const sb = b.standing

  if (sb.pts !== sa.pts) return sb.pts - sa.pts
  if (sb.gd !== sa.gd) return sb.gd - sa.gd

  const gfA = sa.gf ?? 0
  const gfB = sb.gf ?? 0
  if (gfB !== gfA) return gfB - gfA

  const fpA = sa.fairPlay ?? 0
  const fpB = sb.fairPlay ?? 0
  if (fpB !== fpA) return fpB - fpA

  return a.group.localeCompare(b.group)
}

export function buildThirdPlaceCombinationKey(
  bestThirdPlaced: QualifiedEntry[],
): string {
  if (bestThirdPlaced.length !== 8) {
    throw new KnockoutBracketError(msg.combinationKeyNeeds8(bestThirdPlaced.length))
  }
  return [...bestThirdPlaced]
    .map(e => e.group)
    .sort()
    .join('')
}

export function findQualifiedByGroup(
  qualified: QualifiedTeams,
  group: GroupLetter,
  place: 1 | 2 | 3,
): QualifiedEntry {
  const list =
    place === 1
      ? qualified.winners
      : place === 2
        ? qualified.runnersUp
        : qualified.bestThirdPlaced

  const found = list.find(e => e.group === group)
  if (!found) {
    const label = place === 3 ? 'mejor tercero' : `${place}.º`
    throw new KnockoutBracketError(msg.noQualifiedEntry(group, label))
  }
  return found
}
