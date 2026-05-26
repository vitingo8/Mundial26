/**
 * Genera lib/fifaMatchCatalog/groupStage.json (partidos 1–72).
 * Fuente: calendario oficial FIFA / roadtrips (orden y enfrentamientos).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'lib', 'fifaMatchCatalog')

/** [matchNumber, group, home, away] — nombres en inglés para emparejar football-data.org */
const ROWS = [
  [1, 'A', 'Mexico', 'South Africa'],
  [2, 'A', 'Korea Republic', 'Czechia'],
  [3, 'B', 'Canada', 'Bosnia and Herzegovina'],
  [4, 'D', 'United States', 'Paraguay'],
  [5, 'C', 'Haiti', 'Scotland'],
  [6, 'D', 'Australia', 'Türkiye'],
  [7, 'C', 'Brazil', 'Morocco'],
  [8, 'B', 'Qatar', 'Switzerland'],
  [9, 'E', 'Ivory Coast', 'Ecuador'],
  [10, 'E', 'Germany', 'Curaçao'],
  [11, 'F', 'Netherlands', 'Japan'],
  [12, 'F', 'Sweden', 'Tunisia'],
  [13, 'H', 'Saudi Arabia', 'Uruguay'],
  [14, 'H', 'Spain', 'Cape Verde'],
  [15, 'G', 'Iran', 'New Zealand'],
  [16, 'G', 'Belgium', 'Egypt'],
  [17, 'I', 'France', 'Senegal'],
  [18, 'I', 'Iraq', 'Norway'],
  [19, 'J', 'Argentina', 'Algeria'],
  [20, 'J', 'Austria', 'Jordan'],
  [21, 'L', 'Ghana', 'Panama'],
  [22, 'L', 'England', 'Croatia'],
  [23, 'K', 'Portugal', 'Congo DR'],
  [24, 'K', 'Uzbekistan', 'Colombia'],
  [25, 'A', 'Czechia', 'South Africa'],
  [26, 'B', 'Switzerland', 'Bosnia and Herzegovina'],
  [27, 'B', 'Canada', 'Qatar'],
  [28, 'A', 'Mexico', 'Korea Republic'],
  [29, 'C', 'Brazil', 'Haiti'],
  [30, 'C', 'Scotland', 'Morocco'],
  [31, 'D', 'Türkiye', 'Paraguay'],
  [32, 'D', 'United States', 'Australia'],
  [33, 'E', 'Germany', 'Ivory Coast'],
  [34, 'E', 'Ecuador', 'Curaçao'],
  [35, 'F', 'Netherlands', 'Sweden'],
  [36, 'F', 'Tunisia', 'Japan'],
  [37, 'H', 'Uruguay', 'Cape Verde'],
  [38, 'H', 'Spain', 'Saudi Arabia'],
  [39, 'G', 'Belgium', 'Iran'],
  [40, 'G', 'New Zealand', 'Egypt'],
  [41, 'I', 'Norway', 'Senegal'],
  [42, 'I', 'France', 'Iraq'],
  [43, 'J', 'Argentina', 'Austria'],
  [44, 'J', 'Jordan', 'Algeria'],
  [45, 'L', 'England', 'Ghana'],
  [46, 'L', 'Panama', 'Croatia'],
  [47, 'K', 'Portugal', 'Uzbekistan'],
  [48, 'K', 'Colombia', 'Congo DR'],
  [49, 'C', 'Scotland', 'Brazil'],
  [50, 'C', 'Morocco', 'Haiti'],
  [51, 'B', 'Switzerland', 'Canada'],
  [52, 'B', 'Bosnia and Herzegovina', 'Qatar'],
  [53, 'A', 'Czechia', 'Mexico'],
  [54, 'A', 'South Africa', 'Korea Republic'],
  [55, 'E', 'Curaçao', 'Ivory Coast'],
  [56, 'E', 'Ecuador', 'Germany'],
  [57, 'F', 'Japan', 'Sweden'],
  [58, 'F', 'Tunisia', 'Netherlands'],
  [59, 'D', 'Türkiye', 'United States'],
  [60, 'D', 'Paraguay', 'Australia'],
  [61, 'I', 'Norway', 'France'],
  [62, 'I', 'Senegal', 'Iraq'],
  [63, 'G', 'Egypt', 'Iran'],
  [64, 'G', 'New Zealand', 'Belgium'],
  [65, 'H', 'Cape Verde', 'Saudi Arabia'],
  [66, 'H', 'Uruguay', 'Spain'],
  [67, 'L', 'Panama', 'England'],
  [68, 'L', 'Croatia', 'Ghana'],
  [69, 'J', 'Algeria', 'Austria'],
  [70, 'J', 'Jordan', 'Argentina'],
  [71, 'K', 'Colombia', 'Portugal'],
  [72, 'K', 'Congo DR', 'Uzbekistan'],
]

/** Pitido en Eastern Daylight (UTC−4), alineado con calendario FIFA / roadtrips. */
const KICKOFF_EDT = {
  1: ['2026-06-11', '15:00'],
  2: ['2026-06-11', '22:00'],
  3: ['2026-06-12', '15:00'],
  4: ['2026-06-12', '21:00'],
  5: ['2026-06-13', '21:00'],
  6: ['2026-06-13', '00:00'],
  7: ['2026-06-13', '18:00'],
  8: ['2026-06-13', '15:00'],
  9: ['2026-06-14', '19:00'],
  10: ['2026-06-14', '13:00'],
  11: ['2026-06-14', '16:00'],
  12: ['2026-06-14', '22:00'],
  13: ['2026-06-15', '18:00'],
  14: ['2026-06-15', '12:00'],
  15: ['2026-06-15', '21:00'],
  16: ['2026-06-15', '15:00'],
  17: ['2026-06-16', '15:00'],
  18: ['2026-06-16', '18:00'],
  19: ['2026-06-16', '21:00'],
  20: ['2026-06-16', '00:00'],
  21: ['2026-06-17', '19:00'],
  22: ['2026-06-17', '16:00'],
  23: ['2026-06-17', '13:00'],
  24: ['2026-06-17', '22:00'],
  25: ['2026-06-18', '12:00'],
  26: ['2026-06-18', '15:00'],
  27: ['2026-06-18', '18:00'],
  28: ['2026-06-18', '21:00'],
  29: ['2026-06-19', '21:00'],
  30: ['2026-06-19', '18:00'],
  31: ['2026-06-19', '23:00'],
  32: ['2026-06-19', '15:00'],
  33: ['2026-06-20', '16:00'],
  34: ['2026-06-20', '20:00'],
  35: ['2026-06-20', '13:00'],
  36: ['2026-06-20', '00:00'],
  37: ['2026-06-21', '18:00'],
  38: ['2026-06-21', '12:00'],
  39: ['2026-06-21', '15:00'],
  40: ['2026-06-21', '21:00'],
  41: ['2026-06-22', '20:00'],
  42: ['2026-06-22', '17:00'],
  43: ['2026-06-22', '13:00'],
  44: ['2026-06-22', '23:00'],
  45: ['2026-06-23', '16:00'],
  46: ['2026-06-23', '19:00'],
  47: ['2026-06-23', '13:00'],
  48: ['2026-06-23', '22:00'],
  49: ['2026-06-24', '18:00'],
  50: ['2026-06-24', '18:00'],
  51: ['2026-06-24', '15:00'],
  52: ['2026-06-24', '15:00'],
  53: ['2026-06-24', '21:00'],
  54: ['2026-06-24', '21:00'],
  55: ['2026-06-25', '16:00'],
  56: ['2026-06-25', '16:00'],
  57: ['2026-06-25', '19:00'],
  58: ['2026-06-25', '19:00'],
  59: ['2026-06-25', '22:00'],
  60: ['2026-06-25', '22:00'],
  61: ['2026-06-26', '15:00'],
  62: ['2026-06-26', '15:00'],
  63: ['2026-06-26', '23:00'],
  64: ['2026-06-26', '23:00'],
  65: ['2026-06-26', '20:00'],
  66: ['2026-06-26', '20:00'],
  67: ['2026-06-27', '17:00'],
  68: ['2026-06-27', '17:00'],
  69: ['2026-06-27', '22:00'],
  70: ['2026-06-27', '22:00'],
  71: ['2026-06-27', '19:30'],
  72: ['2026-06-27', '19:30'],
}

/** Hora Eastern Daylight (UTC−4) → ISO UTC. */
function edtToUtc(dateKey, timeHHMM) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm] = timeHHMM.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh + 4, mm)).toISOString()
}

const catalog = ROWS.map(([n, g, home, away]) => {
  const slot = KICKOFF_EDT[n]
  if (!slot) throw new Error(`Missing kickoff for match ${n}`)
  return { n, g, home, away, utcDate: edtToUtc(slot[0], slot[1]) }
})

mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'groupStage.json'),
  `${JSON.stringify(catalog, null, 2)}\n`,
  'utf8',
)
console.log(`Wrote ${catalog.length} group-stage entries to groupStage.json`)
