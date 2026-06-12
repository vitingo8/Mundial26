/** Ancla de reloj en vivo a partir de datos FotMob (se interpola localmente entre polls). */

export function buildLiveClockAnchor(liveTime, minute) {
  if (!liveTime && minute == null) return null

  let totalSeconds = 0

  if (liveTime?.long) {
    const m = String(liveTime.long).trim().match(/^(\d+):(\d{2})$/)
    if (m) totalSeconds = Number(m[1]) * 60 + Number(m[2])
  }

  if (totalSeconds === 0 && liveTime?.short) {
    const m = parseInt(String(liveTime.short).replace(/\D/g, ''), 10)
    if (!Number.isNaN(m)) totalSeconds = m * 60
  }

  if (totalSeconds === 0 && minute != null && Number.isFinite(Number(minute))) {
    totalSeconds = Number(minute) * 60
  }

  if (!totalSeconds && !liveTime?.long && !liveTime?.short && minute == null) return null

  const addedTime = liveTime?.addedTime > 0 ? liveTime.addedTime : 0

  return {
    totalSeconds,
    addedTime,
    key: `${liveTime?.long ?? ''}|${liveTime?.short ?? ''}|${minute ?? ''}|${addedTime}`,
  }
}

export function formatSimulatedClock(anchor, elapsedSeconds = 0) {
  const total = anchor.totalSeconds + Math.max(0, elapsedSeconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  const clock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  const addedTime = anchor.addedTime > 0
    ? `+0:${String(anchor.addedTime).padStart(2, '0')}`
    : null

  return { clock, addedTime, compact: clock, short: `${mins}'` }
}

export function formatPausedLiveClock() {
  return { clock: 'Descanso', addedTime: null, compact: 'HT', short: 'HT' }
}
