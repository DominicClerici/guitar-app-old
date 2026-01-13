import { signUpZod, z } from "@guitar/schemas"
import { SupabaseClient } from "@supabase/supabase-js"
import { TRPCError } from "@trpc/server"

export default async function registerUser(
  input: z.infer<typeof signUpZod>,
  supabase: SupabaseClient,
) {
  const { name, email, password } = input

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  })

  if (error) {
    console.error("Could not register user: ", error)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    })
  }
  return { error: null }
}
