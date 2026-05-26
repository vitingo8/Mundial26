import {
  BRACKET_LEFT_COLUMNS,
  BRACKET_RIGHT_COLUMNS,
  BRACKET_CENTER,
  BRACKET_ROWS,
} from './knockoutBracketTreeLayout'

/** Mitad superior = cuadro izquierdo; mitad inferior = cuadro derecho */
export const BRACKET_MOBILE_HALF_ROWS = BRACKET_ROWS
export const BRACKET_MOBILE_ROWS = BRACKET_ROWS * 2

const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf']

/** Celdas de una columna sobre grid de N filas */
export function getColumnCells(column, rowOffset = 0) {
  const cells = []
  if (column.pairs) {
    for (const pair of column.pairs) {
      pair.matches.forEach((matchNum, idx) => {
        cells.push({
          rowStart: pair.rowStart + idx + rowOffset,
          rowSpan: 1,
          matchNum,
        })
      })
    }
  }
  if (column.slots) {
    for (const slot of column.slots) {
      cells.push({
        rowStart: slot.rowStart + rowOffset,
        rowSpan: slot.rowSpan,
        matchNum: slot.match,
      })
    }
  }
  return cells
}

function mergePhaseColumn(roundId) {
  const left = BRACKET_LEFT_COLUMNS.find(c => c.id === roundId)
  const right = BRACKET_RIGHT_COLUMNS.find(c => c.id === roundId)
  if (!left || !right) return null

  return {
    id: roundId,
    label: left.label,
    rowCount: BRACKET_MOBILE_ROWS,
    cells: [
      ...getColumnCells(left, 0),
      ...getColumnCells(right, BRACKET_MOBILE_HALF_ROWS),
    ],
  }
}

const CENTER_COLUMN = {
  id: 'center',
  label: 'Final',
  rowCount: BRACKET_MOBILE_ROWS,
  cells: [
    { rowStart: 4, rowSpan: 8, matchNum: BRACKET_CENTER.final },
    { rowStart: 13, rowSpan: 2, matchNum: BRACKET_CENTER.third },
  ],
}

/** Una columna por fase: arriba cuadro izq., abajo cuadro dcho. */
export const BRACKET_MOBILE_COLUMNS = [
  ...ROUND_ORDER.map(mergePhaseColumn).filter(Boolean),
  CENTER_COLUMN,
]

export { BRACKET_CENTER, BRACKET_ROWS }
