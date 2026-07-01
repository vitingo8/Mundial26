/** Plazos de la porra: siempre hora civil de Madrid (Europe/Madrid, CEST/CET). */

export const MADRID_TZ = 'Europe/Madrid'

function getMadridWallClock(utcMs) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: MADRID_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(utcMs))
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value]),
  )
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour,
    minute: +parts.minute,
  }
}

/** ISO UTC → valor para `<input type="datetime-local">` (hora Madrid). */
export function toMadridDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = getMadridWallClock(d.getTime())
  const pad = n => String(n).padStart(2, '0')
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

/** Valor datetime-local (hora Madrid) → ISO UTC para TIMESTAMPTZ. */
export function fromMadridDatetimeLocal(localValue) {
  if (!localValue?.trim()) return null
  const m = localValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return null

  const year = +m[1]
  const month = +m[2]
  const day = +m[3]
  const hour = +m[4]
  const minute = +m[5]

  let utcMs = Date.UTC(year, month - 1, day, hour - 2, minute)
  for (let i = 0; i < 5; i++) {
    const wall = getMadridWallClock(utcMs)
    const targetMin = hour * 60 + minute
    const actualMin = wall.hour * 60 + wall.minute
    const dayDelta = day - wall.day
    const adjustMin = dayDelta * 24 * 60 + (targetMin - actualMin)
    if (adjustMin === 0) break
    utcMs += adjustMin * 60 * 1000
  }

  const iso = new Date(utcMs).toISOString()
  const check = getMadridWallClock(utcMs)
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.hour !== hour ||
    check.minute !== minute
  ) {
    return null
  }
  return iso
}

/** Mostrar plazo guardado en hora de Madrid. */
export function formatMadridDateTime(iso, options = {}) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: MADRID_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(d)
}

/** Fecha/hora corta en Madrid: dd/mm hh:mm (sin año). Para "actualizado el...". */
export function formatMadridShortDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = getMadridWallClock(d.getTime())
  const pad = n => String(n).padStart(2, '0')
  return `${pad(parts.day)}/${pad(parts.month)} ${pad(parts.hour)}:${pad(parts.minute)}`
}

/** Offset Madrid en ese instante, p. ej. "+02:00" o "+01:00". */
export function madridOffsetLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TZ,
    timeZoneName: 'shortOffset',
  }).formatToParts(d)
  return parts.find(p => p.type === 'timeZoneName')?.value?.replace('GMT', 'UTC') || ''
}
