"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const hasRun = useRef(false)

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasRun.current) return
    hasRun.current = true

    const handleCallback = async () => {
      const supabase = createClient()

      // Get the hash fragment (everything after #)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")
      const type = hashParams.get("type")

      // Also check query params for PKCE flow
      const queryParams = new URLSearchParams(window.location.search)
      const code = queryParams.get("code")
      const queryType = queryParams.get("type")

      let next = "/"
      const effectiveType = type || queryType

      if (effectiveType === "recovery") {
        next = "/auth/reset-password"
      } else if (effectiveType === "email_change") {
        next = "/dashboard/settings?email_changed=true"
      }

      try {
        // Handle implicit flow (tokens in hash)
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            console.error("setSession failed", error)
            setError(error.message)
            return
          }

          router.replace(next)
          return
        }

        // Handle PKCE flow (code in query params)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error("exchangeCodeForSession failed", error)
            setError(error.message)
            return
          }

          router.replace(next)
          return
        }

        // No valid auth params found
        setError("No authentication parameters found")
      } catch (err) {
        // Ignore abort errors from React Strict Mode remounting
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        console.error("Auth callback error", err)
        setError(err instanceof Error ? err.message : "An unexpected error occurred")
      }
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-600">Authentication Error</h1>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="border-primary size-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="text-muted-foreground mt-4">Authenticating...</p>
      </div>
    </div>
  )
}
