import { createClient } from "@/lib/supabase/server"
import AuthClient from "./auth-client"

export default async function AuthTopBar() {
  const supabase = await createClient()
  const user = await supabase.auth.getUser()
  return <AuthClient user={user.data.user} />
}
