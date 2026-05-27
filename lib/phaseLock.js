import {
  isGroupDeadlinePassed,
  isBonusDeadlinePassed,
  isKnockoutPhaseFullyLocked,
} from './deadlines'

export function isPhaseLocked(groupPhase, predPhase, isAdmin, adminOverride) {
  if (isAdmin && adminOverride) return false
  if (groupPhase === 'knockout' && predPhase === 'group') return true
  if (groupPhase === 'finished' && (predPhase === 'group' || predPhase === 'knockout')) return true
  return false
}

export function getPhaseLockMessage(groupPhase, predPhase) {
  if (groupPhase === 'knockout' && predPhase === 'group') {
    return 'La fase de grupos está cerrada — el torneo está en eliminatorias.'
  }
  if (groupPhase === 'finished' && predPhase === 'group') {
    return 'El torneo ha finalizado — la porra de grupos ya no se puede editar.'
  }
  if (groupPhase === 'finished' && predPhase === 'knockout') {
    return 'El torneo ha finalizado — la porra de eliminatorias ya no se puede editar.'
  }
  return null
}

export function msUntilDeadline(deadline) {
  if (!deadline) return null
  const ms = new Date(deadline) - Date.now()
  return ms > 0 ? ms : 0
}

export function formatCountdown(ms) {
  if (ms == null) return null
  if (ms <= 0) return 'Plazo cerrado'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 48) return `${Math.floor(h / 24)} d ${h % 24} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

export function isPredPhaseEditable(predPhase, group, isAdmin, adminOverride, options = {}) {
  if (isPhaseLocked(group?.phase, predPhase, isAdmin, adminOverride)) return false
  if (predPhase === 'group' && isGroupDeadlinePassed(group)) return false
  if (predPhase === 'knockout') {
    const { knockoutMatches = [] } = options
    if (isKnockoutPhaseFullyLocked(knockoutMatches)) return false
    return true
  }
  if (predPhase === 'bonuses' && isBonusDeadlinePassed(group)) return false
  return true
}
