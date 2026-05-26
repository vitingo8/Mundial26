/** Filas verticales del grid (8 dieciseisavos por bando). */
export const BRACKET_ROWS = 8

export const BRACKET_CENTER = { final: 104, third: 103 }

/** Centro vertical de la final (grid-row 4 / span 2, alineado con semifinales). */
export const BRACKET_FINAL_CONNECT_Y = spanCenter(3, 2)

/** @deprecated alias */
export const BRACKET_FINAL_CENTER_Y = BRACKET_FINAL_CONNECT_Y

export function rowCenter(rowIndex, total = BRACKET_ROWS) {
  return ((rowIndex + 0.5) / total) * 100
}

export function spanCenter(rowStart, rowSpan, total = BRACKET_ROWS) {
  return ((rowStart + rowSpan / 2) / total) * 100
}

/**
 * Columnas de izquierda a derecha: de fuera hacia el centro.
 */
export const BRACKET_LEFT_COLUMNS = [
  {
    id: 'r32',
    label: 'Dieciseisavos',
    side: 'left',
    pairs: [
      { rowStart: 0, matches: [73, 75] },
      { rowStart: 2, matches: [74, 77] },
      { rowStart: 4, matches: [83, 84] },
      { rowStart: 6, matches: [81, 82] },
    ],
  },
  {
    id: 'r16',
    label: 'Octavos',
    side: 'left',
    slots: [
      { rowStart: 0, rowSpan: 2, match: 90 },
      { rowStart: 2, rowSpan: 2, match: 89 },
      { rowStart: 4, rowSpan: 2, match: 93 },
      { rowStart: 6, rowSpan: 2, match: 94 },
    ],
  },
  {
    id: 'qf',
    label: 'Cuartos',
    side: 'left',
    slots: [
      { rowStart: 0, rowSpan: 4, match: 97 },
      { rowStart: 4, rowSpan: 4, match: 98 },
    ],
  },
  {
    id: 'sf',
    label: 'Semifinal',
    side: 'left',
    slots: [{ rowStart: 0, rowSpan: 8, match: 101 }],
  },
]

export const BRACKET_RIGHT_COLUMNS = [
  {
    id: 'sf',
    label: 'Semifinal',
    side: 'right',
    slots: [{ rowStart: 0, rowSpan: 8, match: 102 }],
  },
  {
    id: 'qf',
    label: 'Cuartos',
    side: 'right',
    slots: [
      { rowStart: 0, rowSpan: 4, match: 99 },
      { rowStart: 4, rowSpan: 4, match: 100 },
    ],
  },
  {
    id: 'r16',
    label: 'Octavos',
    side: 'right',
    slots: [
      { rowStart: 0, rowSpan: 2, match: 91 },
      { rowStart: 2, rowSpan: 2, match: 92 },
      { rowStart: 4, rowSpan: 2, match: 95 },
      { rowStart: 6, rowSpan: 2, match: 96 },
    ],
  },
  {
    id: 'r32',
    label: 'Dieciseisavos',
    side: 'right',
    pairs: [
      { rowStart: 0, matches: [76, 78] },
      { rowStart: 2, matches: [79, 80] },
      { rowStart: 4, matches: [86, 88] },
      { rowStart: 6, matches: [85, 87] },
    ],
  },
]

/** Carriles de conexión (entre columnas consecutivas). */
export const BRACKET_LEFT_LANES = [
  {
    id: 'r32-r16',
    side: 'left',
    segments: [
      { type: 'pair', rows: [0, 1], targetY: spanCenter(0, 2) },
      { type: 'pair', rows: [2, 3], targetY: spanCenter(2, 2) },
      { type: 'pair', rows: [4, 5], targetY: spanCenter(4, 2) },
      { type: 'pair', rows: [6, 7], targetY: spanCenter(6, 2) },
    ],
  },
  {
    id: 'r16-qf',
    side: 'left',
    segments: [
      { type: 'merge', sourceYs: [spanCenter(0, 2), spanCenter(2, 2)], targetY: spanCenter(0, 4) },
      { type: 'merge', sourceYs: [spanCenter(4, 2), spanCenter(6, 2)], targetY: spanCenter(4, 4) },
    ],
  },
  {
    id: 'qf-sf',
    side: 'left',
    segments: [
      { type: 'merge', sourceYs: [spanCenter(0, 4), spanCenter(4, 4)], targetY: spanCenter(0, 8) },
    ],
  },
  {
    id: 'sf-center',
    side: 'left',
    segments: [
      {
        type: 'finalFeed',
        sfY: spanCenter(0, 8),
        finalY: BRACKET_FINAL_CONNECT_Y,
      },
    ],
  },
]

export const BRACKET_RIGHT_LANES = [
  {
    id: 'center-sf',
    side: 'right',
    segments: [
      {
        type: 'finalFeed',
        sfY: spanCenter(0, 8),
        finalY: BRACKET_FINAL_CONNECT_Y,
      },
    ],
  },
  {
    id: 'sf-qf',
    side: 'right',
    segments: [
      { type: 'merge', sourceYs: [spanCenter(0, 4), spanCenter(4, 4)], targetY: spanCenter(0, 8) },
    ],
  },
  {
    id: 'qf-r16',
    side: 'right',
    segments: [
      { type: 'merge', sourceYs: [spanCenter(0, 2), spanCenter(2, 2)], targetY: spanCenter(0, 4) },
      { type: 'merge', sourceYs: [spanCenter(4, 2), spanCenter(6, 2)], targetY: spanCenter(4, 4) },
    ],
  },
  {
    id: 'r16-r32',
    side: 'right',
    segments: [
      { type: 'pair', rows: [0, 1], targetY: spanCenter(0, 2) },
      { type: 'pair', rows: [2, 3], targetY: spanCenter(2, 2) },
      { type: 'pair', rows: [4, 5], targetY: spanCenter(4, 2) },
      { type: 'pair', rows: [6, 7], targetY: spanCenter(6, 2) },
    ],
  },
]

/** @deprecated */
export const BRACKET_LEFT_TREE = { sf: 101, quarters: [] }
/** @deprecated */
export const BRACKET_RIGHT_TREE = { sf: 102, quarters: [] }
