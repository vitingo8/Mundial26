/** Grupo del Mundial 2026 (12 grupos). */
export type GroupLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'

export const GROUP_LETTERS: GroupLetter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
]

export interface Team {
  name: string
  code?: string
  crest?: string | null
}

export interface GroupStanding {
  group: GroupLetter
  position: number
  team: string
  code?: string
  crest?: string | null
  pts: number
  pj: number
  w?: number
  d?: number
  l?: number
  gd: number
  gf?: number
  gc?: number
  fairPlay?: number
}

export type GroupsInput = Record<GroupLetter, GroupStanding[]>

export interface QualifiedEntry {
  group: GroupLetter
  standing: GroupStanding
  team: Team
}

export interface QualifiedTeams {
  winners: QualifiedEntry[]
  runnersUp: QualifiedEntry[]
  thirdPlaced: QualifiedEntry[]
  bestThirdPlaced: QualifiedEntry[]
}

export interface BracketMatch {
  match: number
  home: string
  away: string
  venue?: string
}

/** matchNumber → grupo del tercer clasificado asignado */
export type ThirdPlaceMatchAssignments = Record<number, GroupLetter>

export type ThirdPlaceCombinationMap = Record<
  string,
  ThirdPlaceMatchAssignments
>

export interface GeneratedKnockoutMatch {
  matchNumber: number
  homeTeam: Team
  awayTeam: Team
  homeSource: string
  awaySource: string
  awayResolvedGroup?: GroupLetter
  homeResolvedGroup?: GroupLetter
  venue?: string
}

export interface GeneratedRoundOf32 {
  round: 'round_of_32'
  combinationKey: string
  matches: GeneratedKnockoutMatch[]
}
