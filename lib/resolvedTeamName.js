/** Etiqueta FIFA (1A, W74…) o placeholder API — no es un equipo resuelto. */
export function isResolvedTeamName(name) {
  if (name == null || name === '') return false
  const n = String(name).trim()
  if (n === '—') return false
  if (/^TBD$/i.test(n)) return false
  return !/^[123WLPG][\dA-L/]*$/.test(n)
}
