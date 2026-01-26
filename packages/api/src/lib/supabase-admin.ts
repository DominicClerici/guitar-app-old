import { createClient } from "@supabase/supabase-js"

function getSupabaseAdminConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables (SUPABASE_SERVICE_ROLE_KEY)")
  }

  return { url, serviceRoleKey }
}

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
