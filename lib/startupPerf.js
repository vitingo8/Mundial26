/**
 * Logs de arranque legibles. Filtra consola por: porra:arranque
 *
 * Dev: activos siempre.
 * Producción: localStorage.setItem('porra_startup_perf', '1') y recarga.
 * Resumen manual: __porraStartupPerf.summary()
 */

export const F = Object.freeze({
  BOOT: 'BOOT',
  PAGE: 'PAGE',
  SESSION: 'SESSION',
  MATCHES: 'MATCHES',
  DASHBOARD: 'DASHBOARD',
  SUPABASE: 'SUPABASE',
  IDLE: 'IDLE',
})

const LOG = '[porra:arranque]'
const WARN_MS = 100
const SLOW_MS = 500
const CRITICAL_MS = 2000

const PHASE = {
  [F.BOOT]: { label: 'ARRANQUE', color: '#94a3b8' },
  [F.PAGE]: { label: 'PÁGINA', color: '#38bdf8' },
  [F.SESSION]: { label: 'SESIÓN', color: '#a78bfa' },
  [F.MATCHES]: { label: 'PARTIDOS', color: '#34d399' },
  [F.DASHBOARD]: { label: 'DASHBOARD', color: '#fbbf24' },
  [F.SUPABASE]: { label: 'SUPABASE', color: '#f472b6' },
  [F.IDLE]: { label: 'SEGUNDO PLANO', color: '#64748b' },
}

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

function fmtMs(n) {
  return `${String(Math.round(n)).padStart(5, ' ')} ms`
}

function severity(delta) {
  if (delta >= CRITICAL_MS) return 'critical'
  if (delta >= SLOW_MS) return 'slow'
  if (delta >= WARN_MS) return 'warn'
  return 'ok'
}

function pauseHint(delta, prevLabel) {
  if (delta < WARN_MS) return null
  const prev = prevLabel ? ` tras «${prevLabel}»` : ''
  if (delta >= CRITICAL_MS) {
    return `BLOQUEO GRAVE (+${Math.round(delta)} ms)${prev}. El hilo principal estuvo ocupado ~${(delta / 1000).toFixed(1)} s sin poder pintar. Suele ser JS pesado, parseo de JSON grande o render masivo.`
  }
  if (delta >= SLOW_MS) {
    return `Pausa notable (+${Math.round(delta)} ms)${prev}. Puede sentirse como lentitud al abrir.`
  }
  return `Pequeña pausa (+${Math.round(delta)} ms)${prev}.`
}

let lastMark = nowMs()
let lastLabel = '(inicio)'
let summaryScheduled = false
const marks = []
const longTasks = []
const openSpans = new Map()

function logLine(phase, message, extra, delta, sinceNav, sev) {
  const meta = PHASE[phase] || PHASE[F.BOOT]
  const badge = `%c ${meta.label} `
  const badgeStyle = `background:${meta.color};color:#0f172a;font-weight:bold;padding:1px 6px;border-radius:3px`
  const time = `%c t+${fmtMs(sinceNav)} │ Δ${fmtMs(delta)} `
  const timeStyle = sev === 'critical'
    ? 'color:#fca5a5;font-weight:bold'
    : sev === 'slow'
      ? 'color:#fcd34d;font-weight:bold'
      : sev === 'warn'
        ? 'color:#fde68a'
        : 'color:#86efac'

  const args = [badge + time + `%c ${message}`, badgeStyle, timeStyle, 'color:inherit']
  if (extra && Object.keys(extra).length) args.push(extra)
  if (sev === 'critical') console.error(LOG, ...args)
  else if (sev === 'slow') console.warn(LOG, ...args)
  else console.log(LOG, ...args)
}

function logPauseHint(delta, prevLabel) {
  const hint = pauseHint(delta, prevLabel)
  if (!hint) return
  const fn = delta >= CRITICAL_MS ? console.error : delta >= SLOW_MS ? console.warn : console.info
  fn(`${LOG} %c↳ ${hint}`, 'color:#94a3b8;font-style:italic')
}

/** Marca un hito con fase, mensaje legible y datos opcionales. */
export function perfMark(phase, message, extra) {
  if (!enabled()) return
  const t = nowMs()
  const sinceNav = t
  const delta = t - lastMark
  const sev = severity(delta)
  const entry = {
    phase,
    message,
    sinceNav: Math.round(sinceNav),
    delta: Math.round(delta),
    severity: sev,
    extra: extra ?? null,
  }
  marks.push(entry)

  if (marks.length > 1) logPauseHint(delta, lastLabel)
  logLine(phase, message, extra, delta, sinceNav, sev)

  lastMark = t
  lastLabel = message
}

/** Operación async con inicio/fin y duración total. */
export async function perfAsync(phase, message, fn) {
  if (!enabled()) return fn()
  const id = `${message}#${nowMs()}`
  perfSpanStart(phase, message, id)
  try {
    const result = await fn()
    perfSpanEnd(phase, message, id, { ok: true })
    return result
  } catch (err) {
    perfSpanEnd(phase, message, id, { ok: false, error: String(err?.message || err) })
    throw err
  }
}

/** Operación sync con duración. */
export function perfSync(phase, message, fn) {
  if (!enabled()) return fn()
  const id = `${message}#${nowMs()}`
  perfSpanStart(phase, message, id)
  try {
    const result = fn()
    perfSpanEnd(phase, message, id, { ok: true })
    return result
  } catch (err) {
    perfSpanEnd(phase, message, id, { ok: false, error: String(err?.message || err) })
    throw err
  }
}

export function perfSpanStart(phase, message, id = message) {
  if (!enabled()) return
  openSpans.set(id, { phase, message, t0: nowMs() })
  perfMark(phase, `${message} — inicio`)
}

export function perfSpanEnd(phase, message, id = message, extra) {
  if (!enabled()) return
  const span = openSpans.get(id)
  openSpans.delete(id)
  const ms = span ? Math.round(nowMs() - span.t0) : null
  perfMark(phase, `${message} — fin`, { duracion_ms: ms, ...extra })
}

/** Tras el dashboard montado: espera 2 frames y lanza resumen automático. */
export function perfWhenInteractive(phase, message, extra) {
  if (!enabled()) return
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      perfMark(phase, message, { ...extra, nota: 'primer frame pintado (hilo libre)' })
      scheduleAutoSummary()
    })
  })
}

function scheduleAutoSummary() {
  if (summaryScheduled) return
  summaryScheduled = true
  setTimeout(() => perfSummary({ auto: true }), 4000)
}

function startLongTaskObserver() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < WARN_MS) continue
        const item = {
          ms: Math.round(entry.duration),
          inicio_ms: Math.round(entry.startTime),
          atribucion: entry.attribution?.map(a => a.name || a.containerType).filter(Boolean).join(', ') || '(desconocido)',
        }
        longTasks.push(item)
        const fn = entry.duration >= SLOW_MS ? console.warn : console.info
        fn(
          `${LOG} %cTAREA LARGA detectada`,
          'background:#dc2626;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px',
          `El navegador bloqueó el hilo principal ${fmtMs(entry.duration)} (desde t+${fmtMs(entry.startTime)}).`,
          item,
        )
      }
    })
    obs.observe({ type: 'longtask', buffered: true })
  } catch {
    /* longtask no disponible en todos los navegadores */
  }
}

export function perfSummary({ auto = false } = {}) {
  if (!enabled()) return marks

  const total = marks.length ? marks[marks.length - 1].sinceNav : 0
  const slow = [...marks]
    .filter(m => m.delta >= WARN_MS)
    .sort((a, b) => b.delta - a.delta)
  const byPhase = {}
  for (const m of marks) {
    byPhase[m.phase] = (byPhase[m.phase] || 0) + 1
  }

  const title = auto ? 'Resumen automático (4 s tras UI interactiva)' : 'Resumen manual'
  console.groupCollapsed(`${LOG} %c${title} — total ${fmtMs(total)}`, 'font-weight:bold;color:#38bdf8')

  console.log(`${LOG} Pasos registrados: ${marks.length}`)
  console.log(`${LOG} Por fase:`, byPhase)
  if (longTasks.length) {
    console.warn(`${LOG} Tareas largas del navegador (${longTasks.length}):`, longTasks)
  } else {
    console.log(`${LOG} Sin tareas largas detectadas por PerformanceObserver (o no soportado).`)
  }

  if (slow.length) {
    console.warn(`${LOG} Top pausas entre hitos (Δ ms):`)
    console.table(slow.slice(0, 8).map(m => ({
      fase: PHASE[m.phase]?.label || m.phase,
      mensaje: m.message,
      delta_ms: m.delta,
      t_ms: m.sinceNav,
      gravedad: m.severity,
    })))
  }

  console.log(`${LOG} Cronología completa:`)
  console.table(marks.map(m => ({
    fase: PHASE[m.phase]?.label || m.phase,
    mensaje: m.message,
    t_ms: m.sinceNav,
    delta_ms: m.delta,
    ...(m.extra && typeof m.extra === 'object' ? m.extra : {}),
  })))

  console.groupEnd()
  return marks
}

if (typeof window !== 'undefined' && enabled()) {
  perfMark(F.BOOT, 'Monitor de arranque activo', {
    tip: 'Filtra consola por "porra:arranque". Resumen: __porraStartupPerf.summary()',
  })
  startLongTaskObserver()
  window.__porraStartupPerf = { marks, longTasks, summary: perfSummary, F }
}
