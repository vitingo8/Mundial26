/** Top funciones por self-time de un .cpuprofile. Uso: node scripts/analyze-cpuprofile.mjs <file> [top] */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const top = Number(process.argv[3] || 30)
const prof = JSON.parse(readFileSync(file, 'utf8'))

const nodesById = new Map(prof.nodes.map(n => [n.id, n]))
const selfTime = new Map()
const totalTime = new Map()

// self time por muestras
const sampleCount = new Map()
for (const id of prof.samples) sampleCount.set(id, (sampleCount.get(id) || 0) + 1)
const totalSamples = prof.samples.length
const durationUs = prof.endTime - prof.startTime
const usPerSample = durationUs / totalSamples

// total time: propagar hacia arriba
const childrenSum = new Map()
function key(n) {
  const f = n.callFrame
  const url = (f.url || '').split(/[\\/]/).slice(-1)[0]
  return `${f.functionName || '(anon)'} ${url}:${f.lineNumber + 1}`
}
for (const [id, count] of sampleCount) {
  const n = nodesById.get(id)
  if (!n) continue
  const k = key(n)
  selfTime.set(k, (selfTime.get(k) || 0) + count * usPerSample / 1000)
}

const rows = [...selfTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
for (const [k, ms] of rows) {
  console.log(`${ms.toFixed(1).padStart(8)} ms  ${k}`)
}
console.log(`\ntotal: ${(durationUs / 1000).toFixed(0)} ms, samples: ${totalSamples}`)
