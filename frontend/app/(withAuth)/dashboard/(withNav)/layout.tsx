import DashboardNav from "@/components/ui/nav/dashboard-nav"
import React from "react"

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex pt-12 pr-8 pl-80">
      <DashboardNav />
      {children}
    </main>
  )
}
