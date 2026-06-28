const TECHNICAL = /cannot convert|typeerror|undefined|null object|failed to|502|503|504|etimedout|fetch failed|webpack|module not|object\.entries/i

/** Mensaje seguro para mostrar al usuario (sin detalles técnicos). */
export function userFacingError(message, fallback = 'No se pudo cargar. Inténtalo de nuevo.') {
  if (!message || typeof message !== 'string') return fallback
  const text = message.trim()
  if (!text || TECHNICAL.test(text) || text.length > 100) return fallback
  return text.replace(/fotmob/gi, 'datos en vivo')
}
