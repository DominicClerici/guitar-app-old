"use client"

import { trpc } from "@/lib/trpc"

export default function TestPage() {
  const { data: user, isLoading } = trpc.user.getUserInfo.useQuery()
  return (
    <>{isLoading ? <p>Loading...</p> : <p>Username: {user?.name || "No name/not logged in"}</p>}</>
  )
}
