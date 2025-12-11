"use server"

import { createClient } from "@/lib/supabase/server"
import { signUpSchema, z } from "@guitar/schemas"

export async function registerUser(data: z.infer<typeof signUpSchema>) {
  try {
    const parsed = signUpSchema.safeParse(data)
    if (!parsed.success) {
      console.error("Validation error:", parsed.error)
      return { error: parsed.error.message }
    }
    const supabase = await createClient()
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          fullName: parsed.data.fullName,
        },
      },
    })
    if (error) {
      console.error("Supabase sign up error:", error)
      return { error: error.message }
    }
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "An unknown error occurred" }
  }
}
