/**
 * Enfoca un input tras el commit de React (evita perder foco por re-render del padre).
 */
export function queueScoreFocus(fn) {
  if (typeof window === 'undefined') return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fn()
    })
  })
}

const SCORE_ROW_SELECTOR = '.schedule-match-row, .bracket-slot'

function scoreFocusScope(row) {
  return (
    row.closest('.schedule-matches-panel')
    || row.closest('.group-standings-grid')
    || row.closest('.schedule-panel')
    || row.closest('.knockout-bracket-scene')
  )
}

function focusHomeInRow(row) {
  if (!row) return
  const home =
    row.querySelector('[data-score-side="home"]')
    || row.querySelector('.schedule-score-input')
  home?.focus()
}

/** Input visitante del mismo partido. */
export function focusAwayInRow(row) {
  if (!row) return
  const away =
    row.querySelector('[data-score-side="away"]')
    || row.querySelectorAll('.schedule-score-input')[1]
  away?.focus()
}

/**
 * Input local del siguiente partido en el mismo panel
 * (clasificación por grupos, calendario diario, Todo o cuadro KO).
 */
export function focusNextMatchHomeScore(currentRow) {
  if (!currentRow || typeof document === 'undefined') return
  const scope = scoreFocusScope(currentRow)
  if (!scope) return

  const rows = scope.querySelectorAll(SCORE_ROW_SELECTOR)
  let advance = false
  for (const row of rows) {
    if (advance) {
      focusHomeInRow(row)
      return
    }
    if (row === currentRow) advance = true
  }
}
