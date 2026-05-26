import { normalizeEmail } from './emailUtils'

export async function findParticipantsByEmail(supabase, email) {
  const norm = normalizeEmail(email)
  const { data: participants, error } = await supabase
    .from('porra_participants')
    .select('id, name, group_id, email, pin_hash')
  if (error) throw error

  const filtered = (participants || []).filter(
    p => p.email && normalizeEmail(p.email) === norm
  )
  if (!filtered.length) return []

  const groupIds = [...new Set(filtered.map(p => p.group_id))]
  const { data: groups } = await supabase
    .from('porra_groups')
    .select('id, name')
    .in('id', groupIds)

  const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g.name]))
  return filtered.map(p => ({
    ...p,
    groupName: groupMap[p.group_id] || p.group_id,
  }))
}
