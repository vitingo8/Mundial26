/** PostgreSQL / PostgREST: columna inexistente o aún no en caché del API. */
export function isMissingDbColumn(error, columnName) {
  if (!error) return false
  const msg = String(error.message || '')
  const code = String(error.code || '')
  return (code === '42703' || code === 'PGRST204') && new RegExp(columnName, 'i').test(msg)
}

/**
 * Actualiza porra_groups; si falla por columna opcional ausente, reintenta sin ella.
 * @returns {{ error: import('@supabase/supabase-js').PostgrestError | null, dropped?: string[] }}
 */
export async function updateGroupWithOptionalColumns(supabase, groupId, patch, optionalColumns = ['results_updated_at', 'league_logo']) {
  let current = { ...patch }
  const dropped = []

  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { error } = await supabase.from('porra_groups').update(current).eq('id', groupId)
    if (!error) return { error: null, dropped }

    const missing = optionalColumns.find(col =>
      current[col] !== undefined && isMissingDbColumn(error, col),
    )
    if (!missing) return { error }

    dropped.push(missing)
    const { [missing]: _removed, ...rest } = current
    current = rest
  }

  return { error: { message: 'No se pudo actualizar el grupo' } }
}
