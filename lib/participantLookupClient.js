import { normalizeEmail } from './emailUtils'

export async function lookupParticipantsByEmail(email) {
  const norm = normalizeEmail(email)
  if (!norm) return []

  const res = await fetch(`/api/participants/by-email?email=${encodeURIComponent(norm)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo comprobar el email')
  }
  return data.matches || []
}
