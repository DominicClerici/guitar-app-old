"use client"

import { createClient } from "@/lib/supabase/client"
import { trpc } from "@/lib/trpc/client"
import { signUpZod, z } from "@guitar/schemas"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react"

type RegisterInput = z.infer<typeof signUpZod>

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => Promise<{ error: string | null }>
  register: (input: RegisterInput) => Promise<{ error: string | null }>
  supabase: SupabaseClient
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ error: null }),
  logout: async () => ({ error: null }),
  register: async () => ({ error: null }),
  supabase: {} as SupabaseClient,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const userSubscription = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Supabase auth event: ", event)
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
      } else {
        setUser(null)
      }
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

  const register = async (input: RegisterInput): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true)
      const { error: registerError } = await trpc.user.registerUser.mutate(input)
      if (registerError) throw registerError
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })
      if (loginError) throw loginError
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register, supabase }}>
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
