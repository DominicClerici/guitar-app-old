import getUserInfo from "@/lib/fetches/getUserInfo"
import AuthClient from "./auth-client"

export default async function AuthTopBar() {
  const user = await getUserInfo()
  return <AuthClient user={user} />
}
