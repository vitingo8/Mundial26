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
 * (clasificación, calendario diario o vista Todo).
 */
export function focusNextMatchHomeScore(currentRow) {
  if (!currentRow || typeof document === 'undefined') return
  const scope =
    currentRow.closest('.schedule-matches-panel')
    || currentRow.closest('.group-standings-grid')
  if (!scope) return

  const rows = scope.querySelectorAll('.schedule-match-row')
  let advance = false
  for (const row of rows) {
    if (advance) {
      const home =
        row.querySelector('[data-score-side="home"]')
        || row.querySelector('.schedule-score-input')
      home?.focus()
      return
    }
    if (row === currentRow) advance = true
  }
}
