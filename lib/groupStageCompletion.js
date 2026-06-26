import { GROUP_LETTERS, emptyGroupMap } from './groupQualificationScoring.js'

function normalizeGroupKey(group) {
  if (!group) return null
  return String(group).replace(/^GROUP_/i, '').toUpperCase()
}

function indexApiMatches(apiMatches) {
  const map = {}
  for (const m of apiMatches || []) {
    map[String(m.id)] = m
  }
  return map
}

export function isGroupMatchFinished(apiMatch) {
  if (!apiMatch || apiMatch.status !== 'FINISHED') return false
  const ft = apiMatch.score?.fullTime
  return ft?.home != null && ft?.away != null
}

/**
 * Grupos cuya fase de grupos terminó (todos los partidos FINISHED con marcador).
 */
export function getCompletedGroupLetters(apiMatches = [], groupMatches = []) {
  const apiIndex = indexApiMatches(apiMatches)
  const completed = new Set()

  for (const letter of GROUP_LETTERS) {
    const inGroup = groupMatches.filter(m => normalizeGroupKey(m.group) === letter)
    if (inGroup.length === 0) continue
    const allDone = inGroup.every(m => isGroupMatchFinished(apiIndex[String(m.id)]))
    if (allDone) completed.add(letter)
  }

  return completed
}

/** Grupos con todos los resultados publicados en la porra (sin depender de la API). */
export function getCompletedGroupLettersFromResults(groupResults = {}, groupMatches = []) {
  const completed = new Set()
  for (const letter of GROUP_LETTERS) {
    const inGroup = groupMatches.filter(m => normalizeGroupKey(m.group) === letter)
    if (inGroup.length === 0) continue
    const allDone = inGroup.every(m => {
      const r = groupResults?.[String(m.id)]
      return r?.home != null && r?.away != null
    })
    if (allDone) completed.add(letter)
  }
  return completed
}

/** Unión de grupos cerrados según API y/o resultados guardados. */
export function mergeCompletedGroupLetters(apiMatches = [], groupMatches = [], groupResults = {}) {
  const completed = getCompletedGroupLetters(apiMatches, groupMatches)
  for (const letter of getCompletedGroupLettersFromResults(groupResults, groupMatches)) {
    completed.add(letter)
  }
  return completed
}

/** Solo plazas de grupos ya cerrados (sin partidos pendientes en ese grupo). */
export function filterQualifiersByCompletedGroups(byGroup, completedGroups) {
  const completed = completedGroups instanceof Set ? completedGroups : new Set(completedGroups || [])
  const out = emptyGroupMap()
  for (const letter of GROUP_LETTERS) {
    if (!completed.has(letter)) continue
    const row = byGroup[letter] || {}
    out[letter] = { 1: row[1] ?? null, 2: row[2] ?? null, 3: row[3] ?? null }
  }
  return out
}
