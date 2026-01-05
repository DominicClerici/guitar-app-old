import { api } from "@/lib/trpc/server"
import Link from "next/link"
import LogoutButton from "./logout-button"
import TestPage from "./testpage"

export default async function Home() {
  const caller = await api()
  const user = await caller.user.getUserInfo()
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1>Hello World</h1>
      <p>Username: {user?.name || "No name/not logged in"}</p>
      <TestPage />
      {user ? <LogoutButton /> : <Link href="/login">Login</Link>}
    </div>
  )
}
