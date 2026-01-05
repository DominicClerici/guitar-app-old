import { db } from "@guitar/db"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"

export interface Context {
  user: User | null
  db: typeof db
  headers: Headers
  supabase: SupabaseClient
}

interface CreateContextOptions {
  headers: Headers
}

// Get environment variables
function getSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return { url, anonKey }
}

export async function createTRPCContext(opts: CreateContextOptions): Promise<Context> {
  let supabase: SupabaseClient
  const { headers } = opts

  // Extract the Authorization header (Bearer token)
  const authHeader = headers.get("Authorization")
  let user: User | null = null
  const { url, anonKey } = getSupabaseConfig()

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)

    // Create a Supabase client with the user's token
    supabase = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Get the user from the token
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()

    user = supabaseUser
  } else {
    supabase = createClient(url, anonKey, {})
  }

  return {
    user,
    db,
    headers,
    supabase,
  }
}

// Type for the authenticated context (after isAuthed middleware)
export interface AuthedContext extends Context {
  user: User
}
