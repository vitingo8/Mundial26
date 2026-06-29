import { normalizeEmail } from './emailUtils'

export async function findParticipantsByEmail(supabase, email) {
  const norm = normalizeEmail(email)
  if (!norm) return []

  const { data: filtered, error } = await supabase
    .from('porra_participants')
    .select('id, name, group_id, email, pin_hash')
    .eq('email', norm)

  if (error) throw error
  if (!filtered?.length) return []

  const groupIds = [...new Set(filtered.map(p => p.group_id))]

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from('porra_groups').select('id, name, league_logo').in('id', groupIds),
    supabase.from('porra_participants').select('group_id').in('group_id', groupIds),
  ])

  const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g]))
  const countByGroup = {}
  for (const row of members || []) {
    countByGroup[row.group_id] = (countByGroup[row.group_id] || 0) + 1
  }

  return filtered.map(p => ({
    ...p,
    groupName: groupMap[p.group_id]?.name || p.group_id,
    league_logo: groupMap[p.group_id]?.league_logo || null,
    participantCount: countByGroup[p.group_id] || 0,
  }))
}

/** Consulta ligera: ¿el email está en más de un grupo? */
export async function hasMultiplePorraGroups(supabase, email) {
  const norm = normalizeEmail(email)
  if (!norm) return false

  const { data, error } = await supabase
    .from('porra_participants')
    .select('group_id')
    .eq('email', norm)

  if (error || !data?.length) return false
  return new Set(data.map(r => r.group_id)).size > 1
}
