import { supabase } from "@/lib/supabase"
import { Session, User } from "@supabase/supabase-js"
import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import { createContext, useContext, useEffect, useState } from "react"
import { sessionRef } from "./sessionRef"

WebBrowser.maybeCompleteAuthSession()

type AuthContextType = {
  session: Session | null
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      sessionRef.current = session
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      sessionRef.current = session
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    try {
      const redirectUrl = AuthSession.makeRedirectUri()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      })

      if (error) throw error

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

        if (result.type === "success") {
          const url = new URL(result.url)
          const params = new URLSearchParams(url.hash.slice(1))
          const accessToken = params.get("access_token")
          const refreshToken = params.get("refresh_token")

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) throw sessionError
          }
        }
      }

      return { error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message }
      }
      return { error: "An unknown error occurred" }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        signOut,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
