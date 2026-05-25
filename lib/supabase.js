import { createClient } from '@supabase/supabase-js'

let client

export function getSupabase() {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return client
}

export const supabase = new Proxy(
  {},
  {
    get(_, prop) {
      return getSupabase()[prop]
    },
  }
)
