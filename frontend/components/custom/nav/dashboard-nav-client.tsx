"use client"

import { UserInfo } from "@/lib/fetches/getUserInfo"
import { usePathname } from "next/navigation"

interface DashboardNavClientProps {
  user: UserInfo | null
}

export default function DashboardNavClient({ user }: DashboardNavClientProps) {
  const pathname = usePathname()
  return (
    <header className="bg-background flex items-center justify-between border-b py-4 shadow-sm">
      <nav className="flex items-center gap-2"></nav>
      <div className="flex items-center gap-2"></div>
    </header>
  )
}
