import { db } from "@guitar/db"
import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@supabase/supabase-js"

export type JWTPayloadWithId = JwtPayload & { id: string }

export interface Context {
  user: JWTPayloadWithId | null
  db: typeof db
  headers: Headers
  supabase: SupabaseClient
}

interface CreateContextOptions {
  headers: Headers
  user?: JWTPayloadWithId | undefined
  supabase?: SupabaseClient
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
  const { headers } = opts

  // If a pre-authenticated supabase client is provided (from Next.js route handler), use it directly
  if (opts.supabase) {
    return {
      user: opts.user ? ({ ...opts.user, id: opts.user.sub } as JWTPayloadWithId) : null,
      db,
      headers,
      supabase: opts.supabase,
    }
  }

  // Fallback: extract JWT from Authorization header (for mobile/non-Next.js callers)
  const authHeader = headers.get("Authorization") ?? headers.get("authorization")
  let user: JWTPayloadWithId | null = null
  const { url, anonKey } = getSupabaseConfig()
  let supabase: SupabaseClient

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    supabase = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
    const { data, error } = await supabase.auth.getClaims(token)
    if (error || !data?.claims) {
      console.error(`Error getting claims: ${error?.message ?? "No claims found"}`)
    }
    const claims = { ...data?.claims, id: data?.claims?.sub ?? "" } as JWTPayloadWithId
    user = claims
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
  user: JWTPayloadWithId
}
