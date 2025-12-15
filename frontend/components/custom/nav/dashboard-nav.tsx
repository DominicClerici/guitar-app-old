import getUserInfo from "@/lib/fetches/getUserInfo"
import DashboardNavClient from "./dashboard-nav-client"

export default async function DashboardNav() {
  const user = await getUserInfo()
  return <DashboardNavClient user={user} />
}
