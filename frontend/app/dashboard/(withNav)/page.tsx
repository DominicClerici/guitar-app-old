import CreateTabButton from "@/components/dashboard/create-tab-button"
import { Card } from "@/components/ui/card"
import getUserInfo from "@/lib/fetches/getUserInfo"
import Link from "next/link"

export default async function page() {
  const user = await getUserInfo({ tabs: true })
  if (!user) {
    return (
      <div>
        Error: User not found. Please login. <Link href="/login">Login</Link>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-7xl pt-24">
      <Card>
        <h1 className="text-2xl font-medium">Your tabs</h1>
        <div className="flex flex-col gap-4">
          {user.tabs.map((tab) => (
            <Link key={tab.id} href={`/dashboard/tab/${tab.id}`}>
              {tab.name}
            </Link>
          ))}
          <CreateTabButton />
        </div>
      </Card>
    </div>
  )
}
