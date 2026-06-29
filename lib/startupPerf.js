/**
 * Tiempos de arranque en consola. Filtra por `[porra:startup]`.
 * En producción: localStorage.setItem('porra_startup_perf', '1') y recarga.
 * Desactivar: localStorage.removeItem('porra_startup_perf')
 */

const LOG_PREFIX = '[porra:startup]'

function enabled() {
  if (typeof window === 'undefined') return false
  if (process.env.NODE_ENV === 'development') return true
  try {
    return localStorage.getItem('porra_startup_perf') === '1'
  } catch {
    return false
  }
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

let lastMark = nowMs()
const marks = []

/** Marca un hito (ms desde navigation start + delta desde la marca anterior). */
export function perfMark(label, detail) {
  if (!enabled()) return
  const t = nowMs()
  const sinceNav = Math.round(t)
  const delta = Math.round(t - lastMark)
  lastMark = t
  const entry = { label, sinceNav, delta, detail }
  marks.push(entry)
  if (detail !== undefined) {
    console.log(`${LOG_PREFIX} +${sinceNav}ms (Δ${delta}ms) ${label}`, detail)
  } else {
    console.log(`${LOG_PREFIX} +${sinceNav}ms (Δ${delta}ms) ${label}`)
  }
}

/** Mide una operación async. */
export async function perfAsync(label, fn) {
  if (!enabled()) return fn()
  const t0 = nowMs()
  perfMark(`${label}…`)
  try {
    const result = await fn()
    perfMark(`${label} ✓`, { ms: Math.round(nowMs() - t0) })
    return result
  } catch (err) {
    perfMark(`${label} ✗`, { ms: Math.round(nowMs() - t0), error: String(err?.message || err) })
    throw err
  }
}

/** Sincroniza y devuelve ms transcurridos. */
export function perfSync(label, fn) {
  if (!enabled()) return fn()
  const t0 = nowMs()
  perfMark(`${label}…`)
  try {
    const result = fn()
    perfMark(`${label} ✓`, { ms: Math.round(nowMs() - t0) })
    return result
  } catch (err) {
    perfMark(`${label} ✗`, { ms: Math.round(nowMs() - t0), error: String(err?.message || err) })
    throw err
  }
}

export function perfSummary() {
  if (!enabled()) return marks
  console.table(marks.map(m => ({
    hito: m.label,
    ms_nav: m.sinceNav,
    delta_ms: m.delta,
    ...(m.detail && typeof m.detail === 'object' ? m.detail : {}),
  })))
  return marks
}

if (typeof window !== 'undefined' && enabled()) {
  perfMark('startupPerf módulo cargado')
  window.__porraStartupPerf = { marks, summary: perfSummary }
}
