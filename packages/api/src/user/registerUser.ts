import { signUpZod, z } from "@guitar/schemas"
import { SupabaseClient } from "@supabase/supabase-js"

export default async function registerUser(
  input: z.infer<typeof signUpZod>,
  supabase: SupabaseClient,
) {
  // TODO: business logic here like stripe etc.
  supabase.auth
  console.log("registerUser", input)

  return { error: null }
}
