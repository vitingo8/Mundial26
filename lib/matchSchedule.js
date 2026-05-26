const TZ = 'Europe/Madrid'

/** Inicio fase de grupos Mundial 2026 */
export const TOURNAMENT_START_KEY = '2026-06-11'

/** Primer día de eliminatorias */
export const KNOCKOUT_START_KEY = '2026-06-29'

/** Días visibles al cargar (ventana principal) */
const VISIBLE_DAY_COUNT = 7

/** Días extra hacia adelante en el scroll */
const SCROLL_PAD_FORWARD = 35

export function matchDateKey(utcDate) {
  if (!utcDate) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(utcDate))
}

export function todayDateKey() {
  return matchDateKey(new Date().toISOString())
}

function minDateKeyForPhase(phase) {
  return phase === 'knockout' ? KNOCKOUT_START_KEY : TOURNAMENT_START_KEY
}

/**
 * Día de referencia de la ventana principal (7 siguientes).
 * Grupos: desde 11-jun; eliminatorias: desde 29-jun.
 */
export function scheduleAnchorDateKey(phase = 'group') {
  const today = todayDateKey()
  const min = minDateKeyForPhase(phase)
  return today < min ? min : today
}

function isOnOrAfterMin(key, minKey) {
  return key && key >= minKey
}

export function shiftDateKey(key, deltaDays) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return matchDateKey(d.toISOString())
}

export function formatMatchKickoff(utcDate, locale = 'es-ES') {
  if (!utcDate) return '—'
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(utcDate))
}

function dayTabFromKey(key, matches, today, primaryKeys) {
  const ref = new Date(`${key}T12:00:00Z`)
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: TZ })
    .format(ref)
    .replace('.', '')
    .toUpperCase()
    .slice(0, 3)
  const dayNum = new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: TZ }).format(ref)
  const month = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: TZ })
    .format(ref)
    .replace('.', '')
    .toUpperCase()

  return {
    key,
    weekday,
    dayNum,
    month,
    isToday: key === today,
    isPrimary: primaryKeys.has(key),
    count: matches.filter(m => matchDateKey(m.utcDate) === key).length,
  }
}

/**
 * Pestañas con scroll a todos los días del torneo (con partidos o en rango),
 * centrando al cargar la ventana de 7 días desde el ancla.
 * @param {'group'|'knockout'} phase
 */
export function buildDayTabs(matches, { phase = 'group' } = {}) {
  const today = todayDateKey()
  const minKey = minDateKeyForPhase(phase)
  const anchor = scheduleAnchorDateKey(phase)
  const keysSet = new Set()

  for (const m of matches) {
    const k = matchDateKey(m.utcDate)
    if (isOnOrAfterMin(k, minKey)) keysSet.add(k)
  }

  for (let i = 0; i < VISIBLE_DAY_COUNT + SCROLL_PAD_FORWARD; i++) {
    const k = shiftDateKey(anchor, i)
    if (isOnOrAfterMin(k, minKey)) keysSet.add(k)
  }

  const sorted = [...keysSet].sort()
  if (sorted.length > 1) {
    let walk = sorted[0]
    const end = sorted[sorted.length - 1]
    while (walk <= end) {
      keysSet.add(walk)
      walk = shiftDateKey(walk, 1)
    }
  } else if (!sorted.length) {
    for (let i = 0; i < VISIBLE_DAY_COUNT; i++) {
      keysSet.add(shiftDateKey(anchor, i))
    }
  }

  const primaryKeys = new Set()
  for (let i = 0; i < VISIBLE_DAY_COUNT; i++) {
    primaryKeys.add(shiftDateKey(anchor, i))
  }

  const keys = [...keysSet].sort()
  return keys.map(key => dayTabFromKey(key, matches, today, primaryKeys))
}

export function groupMatchesByDay(matches) {
  const map = {}
  for (const m of matches) {
    const k = matchDateKey(m.utcDate) || 'unknown'
    if (!map[k]) map[k] = []
    map[k].push(m)
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
  }
  return map
}
