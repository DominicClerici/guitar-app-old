import "server-only"

import { createClient } from "@/lib/supabase/server"
import { appRouter, createCallerFactory, createTRPCContext } from "@guitar/api"
import { headers } from "next/headers"
import { cache } from "react"

// Create a caller factory for server-side calls
const createCaller = createCallerFactory(appRouter)

// Create a cached context for the current request
const createContext = cache(async () => {
  const heads = await headers()

  // Get the Supabase session from cookies
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Create new headers with the auth token if we have a session
  const newHeaders = new Headers(heads)
  if (session?.access_token) {
    newHeaders.set("Authorization", `Bearer ${session.access_token}`)
  }

  return createTRPCContext({
    headers: newHeaders,
  })
})

// Create a server-side caller that can be used in Server Components
export const api = async () => {
  const ctx = await createContext()
  return createCaller(ctx)
}
