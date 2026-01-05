import type { Session } from "@supabase/supabase-js"

/**
 * Shared session reference for synchronous access across the app.
 * Updated by AuthProvider when session changes.
 * Used by tRPC client to avoid async getSession() calls on every request.
 */
export const sessionRef: { current: Session | null } = { current: null }
