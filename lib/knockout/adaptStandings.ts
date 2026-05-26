import { GROUP_LETTERS, type GroupLetter, type GroupStanding, type GroupsInput } from './types'

interface ComputedTeamRow {
  name: string
  crest?: string | null
  pts: number
  pj: number
  gf: number
  gc: number
  dg: number
}

interface ComputedGroupBlock {
  id: string
  teams: ComputedTeamRow[]
}

/**
 * Convierte la salida de computeGroupStandings (JS) a GroupsInput para el bracket.
 */
export function standingsBlocksToGroupsInput(
  blocks: ComputedGroupBlock[],
): GroupsInput {
  const groups = {} as GroupsInput

  for (const letter of GROUP_LETTERS) {
    const block = blocks.find(b => b.id === letter)
    if (!block) {
      groups[letter] = []
      continue
    }
    groups[letter] = block.teams.map((t, i) => ({
      group: letter as GroupLetter,
      position: i + 1,
      team: t.name,
      crest: t.crest,
      pts: t.pts,
      pj: t.pj,
      gd: t.dg,
      gf: t.gf,
      gc: t.gc,
    }))
  }

  return groups
}

export function groupsInputFromStandingsArray(
  entries: GroupStanding[],
): GroupsInput {
  const groups = {} as GroupsInput
  for (const letter of GROUP_LETTERS) {
    groups[letter] = []
  }
  for (const row of entries) {
    groups[row.group].push(row)
  }
  for (const letter of GROUP_LETTERS) {
    groups[letter].sort((a, b) => a.position - b.position)
  }
  return groups
}
