/**
 * Genera thirdPlaceCombinationMap.json desde la tabla Annex C (Wikipedia / FIFA 2026).
 * Fuente: combinaciones 1–495, columnas 1Avs…1Lvs → partidos 79,85,81,74,82,77,87,80.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const WINNER_SLOT_MATCH = {
  '1Avs': 79,
  '1Bvs': 85,
  '1Dvs': 81,
  '1Evs': 74,
  '1Gvs': 82,
  '1Ivs': 77,
  '1Kvs': 87,
  '1Lvs': 80,
}

const ROW_RE =
  /\|\s*(\d+)\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*([A-L])\s*\|\s*3([A-L])\s*\|\s*3([A-L])\s*\|\s*3([A-L])\s*\|\s*3([A-L])\s*\|\s*3([A-L])\s*\|\s*3([A-L])\s*\|\s*3([A-L])\s*\|\s*3([A-L])\s*\|/

function parseWikipediaTable(text) {
  const map = {}
  const slots = Object.keys(WINNER_SLOT_MATCH)

  for (const line of text.split('\n')) {
    const m = line.match(ROW_RE)
    if (!m) continue

    const groups = m.slice(2, 10)
    const key = [...groups].sort().join('')
    const thirdLetters = m.slice(10, 18)

    const assignments = {}
    slots.forEach((slot, i) => {
      assignments[WINNER_SLOT_MATCH[slot]] = thirdLetters[i]
    })

    if (map[key] && JSON.stringify(map[key]) !== JSON.stringify(assignments)) {
      console.warn(`Duplicate key ${key} with different assignments`)
    }
    map[key] = assignments
  }

  return map
}

const wikiPath = process.argv[2]
const source = wikiPath
  ? fs.readFileSync(wikiPath, 'utf8')
  : fs.readFileSync(
      path.join(root, 'data', 'fifa-2026-third-place-combinations.txt'),
      'utf8',
    )

const map = parseWikipediaTable(source)
const keys = Object.keys(map).sort()

if (keys.length < 400) {
  console.error(`Expected ~495 combinations, got ${keys.length}`)
  process.exit(1)
}

const outJson = path.join(root, 'lib', 'knockout', 'config', 'thirdPlaceCombinationMap.json')
fs.writeFileSync(outJson, JSON.stringify(map, null, 0))

const outTs = path.join(root, 'lib', 'knockout', 'config', 'thirdPlaceCombinationMap.ts')
const tsContent = `import type { ThirdPlaceCombinationMap } from '../types'

/**
 * Tabla oficial FIFA (Anexo C): 495 combinaciones de 8 mejores terceros.
 * Generado con: node scripts/build-third-place-map.mjs
 * No editar a mano salvo correcciones puntuales.
 */
export const thirdPlaceCombinationMap: ThirdPlaceCombinationMap = ${JSON.stringify(map, null, 2)} as ThirdPlaceCombinationMap
`
fs.writeFileSync(outTs, tsContent)

console.log(`Wrote ${keys.length} combinations → ${outTs}`)
const sample = map.CEGHIJKL
if (sample) {
  console.log('CEGHIJKL sample:', sample)
}
