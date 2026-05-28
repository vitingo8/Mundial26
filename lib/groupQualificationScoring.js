import { teamsMatch, normalizeTeamName } from './fifaMatchNumbers.js'
import { computeGroupStandings } from './groupStandings.js'
import { isResolvedTeamName } from './knockoutMatchScoring.js'
import { filterApiKnockoutR32 } from './knockoutBridge.js'
import { standingsBlocksToGroupsInput, getQualifiedTeams } from './knockout/dist/index.js'

export const GROUP_LETTERS = /** @type {const} */ (
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
)

/** +1 si el equipo clasifica; +1 extra si aciertas 1.º / 2.º / 3.º (mejor tercero). */
export const QUALIFICATION_SCORING = {
  qualifies: 1,
  exactPosition: 1,
}

function emptyGroupMap() {
  return Object.fromEntries(GROUP_LETTERS.map(g => [g, { 1: null, 2: null, 3: null }]))
}

/**
 * @param {string} source — 1A, 2B, 3A/B/C/D/F
 * @returns {{ position: 1|2|3, groups: string[] } | null}
 */
export function parseGroupSlotSource(source) {
  if (!source) return null
  const s = String(source).trim()
  const direct = /^([123])([A-L])$/.exec(s)
  if (direct) {
    return { position: Number(direct[1]), groups: [direct[2]] }
  }
  const third = /^3([A-L](?:\/[A-L])*)$/.exec(s)
  if (third) {
    return { position: 3, groups: third[1].split('/') }
  }
  return null
}

/** Grupo FIFA de cada selección (catálogo estático de fase de grupos). */
export function buildTeamToGroupLetterMap(groupMatches = []) {
  const map = new Map()
  for (const m of groupMatches || []) {
    const g = m.group
    if (!g) continue
    for (const name of [m.home, m.away, m.homeTeam, m.awayTeam]) {
      if (!name) continue
      const key = normalizeTeamName(name)
      if (key) map.set(key, g)
    }
  }
  return map
}

function resolveTeamGroup(teamName, teamToGroup) {
  const key = normalizeTeamName(teamName)
  return key ? teamToGroup.get(key) ?? null : null
}

/**
 * Clasificados reales según dieciseisavos API (plazas 1A, 2B, 3… en homeSource/awaySource).
 */
export function buildActualQualifiersFromApiR32(apiKnockoutMatches = [], groupMatches = []) {
  const byGroup = emptyGroupMap()
  const teamToGroup = buildTeamToGroupLetterMap(groupMatches)
  const r32 = filterApiKnockoutR32(apiKnockoutMatches)
  let resolved = 0

  for (const m of r32) {
    const sides = [
      { team: m.home, source: m.homeSource },
      { team: m.away, source: m.awaySource },
    ]
    for (const { team, source } of sides) {
      if (!isResolvedTeamName(team)) continue
      const parsed = parseGroupSlotSource(source)
      if (!parsed) continue

      if (parsed.position === 3) {
        const group = resolveTeamGroup(team, teamToGroup)
        if (!group || !parsed.groups.includes(group)) continue
        if (!byGroup[group][3]) {
          byGroup[group][3] = team
          resolved += 1
        }
        continue
      }

      const group = parsed.groups[0]
      if (!GROUP_LETTERS.includes(group)) continue
      if (!byGroup[group][parsed.position]) {
        byGroup[group][parsed.position] = team
        resolved += 1
      }
    }
  }

  return {
    byGroup,
    resolvedCount: resolved,
    ready: resolved > 0,
  }
}

/**
 * Clasificados previstos según marcadores de grupos (1.º, 2.º y mejores terceros).
 */
export function buildPredictedQualifiersFromGroupPreds(groupMatches = [], groupPreds = {}) {
  const blocks = computeGroupStandings(groupMatches, groupPreds)
  if (blocks.length < 12) {
    return { byGroup: emptyGroupMap(), complete: false }
  }

  const groups = standingsBlocksToGroupsInput(blocks)
  const q = getQualifiedTeams(groups)
  const byGroup = emptyGroupMap()

  for (const e of q.winners) byGroup[e.group][1] = e.team.name
  for (const e of q.runnersUp) byGroup[e.group][2] = e.team.name
  for (const e of q.bestThirdPlaced) byGroup[e.group][3] = e.team.name

  return { byGroup, complete: true }
}

function groupHasActual(actualRow) {
  return !!(actualRow?.[1] || actualRow?.[2] || actualRow?.[3])
}

/**
 * @returns {{ total: number, qualifies: number, exactPosition: number, slots: object[] }}
 */
export function calcQualificationPointsSplit(predictedByGroup, actualByGroup) {
  let qualifies = 0
  let exactPosition = 0
  const slots = []

  for (const letter of GROUP_LETTERS) {
    const pred = predictedByGroup[letter] || {}
    const actual = actualByGroup[letter] || {}
    if (!groupHasActual(actual)) continue

    const predictedSlots = /** @type {[1|2|3, string][]} */ (
      [1, 2, 3]
        .map(pos => [pos, pred[pos]])
        .filter(([, team]) => team)
    )

    const actualSlots = /** @type {[1|2|3, string][]} */ (
      [1, 2, 3]
        .map(pos => [pos, actual[pos]])
        .filter(([, team]) => team)
    )

    for (const [predPos, predTeam] of predictedSlots) {
      const hit = actualSlots.find(([, actualTeam]) => teamsMatch(predTeam, actualTeam))
      if (!hit) continue
      qualifies += QUALIFICATION_SCORING.qualifies
      const exact = hit[0] === predPos
      if (exact) exactPosition += QUALIFICATION_SCORING.exactPosition
      slots.push({
        group: letter,
        team: predTeam,
        predictedPosition: predPos,
        actualPosition: hit[0],
        qualifiesPts: QUALIFICATION_SCORING.qualifies,
        exactPts: exact ? QUALIFICATION_SCORING.exactPosition : 0,
      })
    }
  }

  return {
    total: qualifies + exactPosition,
    qualifies,
    exactPosition,
    slots,
  }
}

export function calcGroupQualificationPoints(
  participant,
  { groupMatches = [], knockoutMatches = [] } = {},
) {
  const preds = participant?.predictions || {}
  const predicted = buildPredictedQualifiersFromGroupPreds(groupMatches, preds.group || {})
  const actual = buildActualQualifiersFromApiR32(knockoutMatches, groupMatches)

  if (!predicted.complete || !actual.ready) {
    return {
      total: 0,
      qualifies: 0,
      exactPosition: 0,
      slots: [],
      ready: false,
      resolvedCount: actual.resolvedCount,
    }
  }

  const split = calcQualificationPointsSplit(predicted.byGroup, actual.byGroup)
  return {
    ...split,
    ready: true,
    resolvedCount: actual.resolvedCount,
  }
}
