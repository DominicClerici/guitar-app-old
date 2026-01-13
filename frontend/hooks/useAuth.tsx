"use client"

import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  supabase: SupabaseClient
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ error: null }),
  logout: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  supabase: {} as SupabaseClient,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const userSubscription = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })
    return () => userSubscription.data.subscription.unsubscribe()
  }, [supabase])

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message }
      }
      return { error: "An unknown error occurred" }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      await supabase.auth.signOut()
      return { error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message }
      }
      return { error: "An unknown error occurred" }
    } finally {
      setIsLoading(false)
    }
  }

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      return { error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message }
      }
      return { error: "An unknown error occurred" }
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, signInWithGoogle, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
