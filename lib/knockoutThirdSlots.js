import { formatFifaSlotCode } from './formatFifaSlot.js'
import { teamsMatch } from './fifaMatchNumbers.js'
import { GROUP_LETTERS, parseGroupSlotSource } from './groupQualificationScoring.js'
import { thirdPlaceCombinationMap } from './knockout/dist/config/thirdPlaceCombinationMap.js'
import {
  buildThirdPlaceQualificationContext,
  getViableThirdCombinationKeysFromQualified,
  isBracketSlotResolvedForTeamState,
  isMathematicallyQualifiedThird,
} from './thirdPlaceQualification.js'

export const PENDING_THIRD_LABEL = 'Pendiente'

/** Plaza de mejor tercero (3A, 3A/B/C…). */
export function isThirdPlaceSlotSource(source) {
  return parseGroupSlotSource(source)?.position === 3
}

/** Mejor tercero matemáticamente clasificado entre los 8 (no verde FotMob). */
export function isThirdQualified(group, ctx) {
  return isMathematicallyQualifiedThird(group, ctx)
}

/**
 * Grupos cuyo tercero está matemáticamente entre los 8 mejores.
 * @returns {string[]}
 */
export function getQualifiedThirdGroupLetters(ctx) {
  return ctx?.qualifiedThirdGroups ?? GROUP_LETTERS.filter(g => isThirdQualified(g, ctx))
}

/**
 * Combinaciones FIFA aún posibles según terceros ya clasificados matemáticamente.
 */
export function getViableThirdCombinationKeys(ctx) {
  if (ctx.viableCombinationKeys) return ctx.viableCombinationKeys
  const qualified = getQualifiedThirdGroupLetters(ctx)
  return getViableThirdCombinationKeysFromQualified(qualified, ctx.completed ?? new Set())
}

/** Partidos FIFA (73–88) donde puede caer el tercero del grupo G. */
export function getThirdMatchNumbersForGroup(group, viableKeys) {
  const matches = new Set()
  for (const key of viableKeys || []) {
    const assignments = thirdPlaceCombinationMap[key]
    if (!assignments) continue
    const matchNum = Object.entries(assignments).find(([, g]) => g === group)?.[0]
    if (matchNum != null) matches.add(Number(matchNum))
  }
  return matches
}

/** ¿El tercero clasificado del grupo G ya tiene partido fijo en el matchNumber? */
export function isBracketSlotResolvedForGroup(group, matchNumber, viableKeys, ctx = null) {
  if (ctx && !isMathematicallyQualifiedThird(group, ctx)) return false
  if (ctx && isBracketSlotResolvedForTeamState(group, ctx)) {
    return ctx.teamStates[group]?.resolvedMatchId === Number(matchNumber)
  }
  const matches = getThirdMatchNumbersForGroup(group, viableKeys)
  return matches.size === 1 && matches.has(Number(matchNumber))
}

export function isCombinationFullyLocked(ctx) {
  const { completed = new Set() } = ctx
  return GROUP_LETTERS.every(letter => completed.has(letter))
}

/**
 * Estado de una plaza de tercero en un partido concreto.
 */
export function resolveThirdSideDisplay(source, matchNumber, ctx) {
  const parsed = parseGroupSlotSource(source)
  const slotLabel = formatFifaSlotCode(source) || source || ''
  if (!parsed || parsed.position !== 3) {
    return {
      isThird: false,
      qualified: false,
      bracketSlotResolved: false,
      pending: false,
      team: null,
      group: null,
      slotLabel,
      qualifiedPendingTeams: [],
    }
  }

  const viableKeys =
    ctx.viableCombinationKeys ?? getViableThirdCombinationKeys(ctx)

  const qualifiedInSlot = parsed.groups
    .filter(g => isThirdQualified(g, ctx))
    .map(g => ({ group: g, team: ctx.allByGroup[g]?.[3] ?? null }))
    .filter(row => row.team)

  const resolvedGroup = parsed.groups.find(
    g =>
      isThirdQualified(g, ctx) &&
      isBracketSlotResolvedForGroup(g, matchNumber, viableKeys, ctx),
  )

  if (resolvedGroup) {
    return {
      isThird: true,
      qualified: true,
      bracketSlotResolved: true,
      pending: false,
      team: ctx.allByGroup[resolvedGroup]?.[3] ?? null,
      group: resolvedGroup,
      slotLabel,
      qualifiedPendingTeams: [],
    }
  }

  const qualifiedPendingInSlot = qualifiedInSlot.filter(
    row => !isBracketSlotResolvedForGroup(row.group, matchNumber, viableKeys, ctx),
  )

  return {
    isThird: true,
    qualified: qualifiedPendingInSlot.length > 0,
    bracketSlotResolved: false,
    pending: true,
    team: null,
    group: null,
    slotLabel,
    qualifiedPendingTeams: qualifiedPendingInSlot,
  }
}

/** Terceros clasificados matemáticamente sin slot fijo en el cuadro. */
export function buildQualifiedThirdsPendingList(ctx) {
  const viableKeys = ctx.viableCombinationKeys ?? getViableThirdCombinationKeys(ctx)
  const out = []

  for (const group of getQualifiedThirdGroupLetters(ctx)) {
    if (isBracketSlotResolvedForTeamState(group, ctx)) continue
    const matches = getThirdMatchNumbersForGroup(group, viableKeys)
    if (matches.size === 1) continue
    const team = ctx.allByGroup[group]?.[3]
    if (!team) continue
    out.push({ group, team, possibleMatches: [...matches].sort((a, b) => a - b) })
  }

  return out.sort((a, b) => a.group.localeCompare(b.group))
}

/** Terceros de grupo aún no confirmados entre los 8 mejores. */
export function buildThirdsPendingQualificationList(ctx) {
  const out = []
  for (const group of GROUP_LETTERS) {
    const state = ctx?.teamStates?.[group]
    if (!state || state.qualificationStatus !== 'pending') continue
    if (!state.team) continue
    out.push({ group, team: state.team })
  }
  return out.sort((a, b) => a.group.localeCompare(b.group))
}

export function formatQualifiedThirdPendingLabel(teamName) {
  const label = teamName ? String(teamName).trim() : ''
  if (!label) return 'Mejor tercero clasificado — rival pendiente'
  return `${label} — clasificado como mejor tercero, rival pendiente`
}

export function formatThirdPendingQualificationLabel(teamName) {
  const label = teamName ? String(teamName).trim() : ''
  if (!label) return 'Pendiente de clasificación como mejor tercero'
  return `${label} — pendiente de clasificación como mejor tercero`
}

export function isKnockoutMatchPendingThird(match) {
  if (!match) return false
  if (match.pendingThirdMatch != null) return Boolean(match.pendingThirdMatch)
  return Boolean(match.homePendingThird || match.awayPendingThird)
}

export { buildThirdPlaceQualificationContext }
