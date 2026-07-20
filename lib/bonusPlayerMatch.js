/** Normaliza nombre de jugador para comparar predicciones vs ganadores reales. */
export function normalizePlayerName(name) {
  if (name == null || name === '') return ''
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const MIN_TOKEN_LEN = 3

function nameTokens(name) {
  return normalizePlayerName(name).split(' ').filter(Boolean)
}

/**
 * Comprueba si la predicción coincide con el ganador real.
 * Acepta variantes: tildes, nombre completo vs apellido, espacios extra.
 */
export function bonusPlayerNamesMatch(prediction, actual) {
  const predNorm = normalizePlayerName(prediction)
  const actualNorm = normalizePlayerName(actual)
  if (!predNorm || !actualNorm) return false
  if (predNorm === actualNorm) return true

  const predTokens = predNorm.split(' ').filter(Boolean)
  const actualTokens = actualNorm.split(' ').filter(Boolean)
  if (!predTokens.length || !actualTokens.length) return false

  const [shorter, longer] =
    predTokens.length <= actualTokens.length
      ? [predTokens, actualTokens]
      : [actualTokens, predTokens]

  const significant = shorter.filter(t => t.length >= MIN_TOKEN_LEN)
  if (!significant.length) return false

  return significant.every(token => longer.includes(token))
}
