"use server"

import { signUpSchema, z } from "@guitar/schemas"
import { createClient } from "../supabase/server"

export default async function registerUser(values: z.infer<typeof signUpSchema>) {
  try {
    const parsed = signUpSchema.safeParse(values)
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
          name: parsed.data.fullName,
        },
      },
    })
    if (error) {
      console.error("Supabase sign up error:", error)
      return { error: error.message }
    }
    return { error: null }
  } catch (error) {
    console.error(error)
    return { error: "An unknown error occurred" }
  }
}
