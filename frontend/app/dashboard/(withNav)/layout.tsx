import DashboardNav from "@/components/ui/nav/dashboard-nav"
import React from "react"

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex pt-4 pl-76">
      <DashboardNav />
      {children}
    </main>
  )
}
