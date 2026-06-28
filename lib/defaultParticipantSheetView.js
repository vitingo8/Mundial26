import { isGroupDeadlinePassed } from './deadlines.js'
import { mergeCompletedGroupLetters } from './groupStageCompletion.js'
import { GROUP_LETTERS } from './groupQualificationScoring.js'
import { KNOCKOUT_START_KEY, todayDateKey } from './matchSchedule.js'

const KNOCKOUT_STAGES = new Set([
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
])

const LIVE_OR_DONE = new Set(['FINISHED', 'IN_PLAY', 'PAUSED'])

/**
 * Vista inicial al abrir la porra de otro jugador (ranking).
 * No depende solo de group.phase en BD (suele quedar en "group").
 */
export function defaultParticipantSheetView({
  groupPhase,
  group,
  apiMatches = [],
  groupMatches = [],
  groupResults = {},
  todayKey = todayDateKey(),
} = {}) {
  if (groupPhase === 'knockout' || groupPhase === 'finished') return 'bracket'

  if (group && isGroupDeadlinePassed(group)) return 'bracket'

  if (todayKey >= KNOCKOUT_START_KEY) return 'bracket'

  const completed = mergeCompletedGroupLetters(apiMatches, groupMatches, groupResults)
  if (completed.size >= GROUP_LETTERS.length) return 'bracket'

  const knockoutUnderway = (apiMatches || []).some(
    m => KNOCKOUT_STAGES.has(m.stage) && LIVE_OR_DONE.has(m.status),
  )
  if (knockoutUnderway) return 'bracket'

  return 'groups'
}
