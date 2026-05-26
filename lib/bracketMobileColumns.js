import {
  BRACKET_LEFT_COLUMNS,
  BRACKET_RIGHT_COLUMNS,
  BRACKET_CENTER,
  BRACKET_ROWS,
} from './knockoutBracketTreeLayout'

const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf']

/** slotH = altura de fila del grid y de cada card (única fuente de verdad) */
export const BRACKET_PHASE_LAYOUT = {
  r32: { slotH: 82, gap: 8 },
  r16: { slotH: 82, gap: 16 },
  qf: { slotH: 84, gap: 18 },
  sf: { slotH: 86, gap: 20 },
  center: { slotH: 88, gap: 12 },
}

function bandMatches(column) {
  const items = []
  if (column.pairs) {
    for (const pair of column.pairs) {
      for (const matchNum of pair.matches) {
        items.push({ matchNum, sortKey: pair.rowStart })
      }
    }
  }
  if (column.slots) {
    for (const slot of column.slots) {
      items.push({ matchNum: slot.match, sortKey: slot.rowStart })
    }
  }
  items.sort((a, b) => a.sortKey - b.sortKey)
  return items.map(({ matchNum }) => matchNum)
}

function buildBandCells(matchNums) {
  return matchNums.map((matchNum, i) => ({
    type: 'match',
    matchNum,
    rowStart: i,
  }))
}

function buildGridTemplateRows(cellCount, layout) {
  return Array(cellCount).fill(`${layout.slotH}px`).join(' ')
}

function dividerOffsetPx(cellCount, layout, dividerAfterRow) {
  if (!dividerAfterRow) return 0
  return dividerAfterRow * layout.slotH + (dividerAfterRow - 1) * layout.gap + layout.gap * 0.5
}

function mergePhaseColumn(roundId) {
  const left = BRACKET_LEFT_COLUMNS.find(c => c.id === roundId)
  const right = BRACKET_RIGHT_COLUMNS.find(c => c.id === roundId)
  const layout = BRACKET_PHASE_LAYOUT[roundId]
  if (!left || !right || !layout) return null

  const topCells = buildBandCells(bandMatches(left))
  const bottomCells = buildBandCells(bandMatches(right)).map(c => ({
    ...c,
    rowStart: c.rowStart + topCells.length,
  }))
  const cells = [...topCells, ...bottomCells]
  const dividerAfterRow = topCells.length

  return {
    id: roundId,
    label: left.label,
    layout,
    dividerAfterRow,
    dividerOffsetPx: dividerOffsetPx(cells.length, layout, dividerAfterRow),
    gridTemplateRows: buildGridTemplateRows(cells.length, layout),
    cells,
  }
}

const centerLayout = BRACKET_PHASE_LAYOUT.center

const CENTER_COLUMN = {
  id: 'center',
  label: 'Final',
  layout: centerLayout,
  dividerAfterRow: 0,
  dividerOffsetPx: 0,
  gridTemplateRows: `${centerLayout.slotH}px ${centerLayout.slotH}px`,
  cells: [
    { type: 'match', rowStart: 0, matchNum: BRACKET_CENTER.final },
    { type: 'match', rowStart: 1, matchNum: BRACKET_CENTER.third },
  ],
}

export const BRACKET_MOBILE_COLUMNS = [
  ...ROUND_ORDER.map(mergePhaseColumn).filter(Boolean),
  CENTER_COLUMN,
]

export { BRACKET_CENTER, BRACKET_ROWS }
