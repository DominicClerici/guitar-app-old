export const dynamic = "force-dynamic"

import DashboardNav from "@/components/custom/nav/dashboard-nav"
import React from "react"

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardNav />
      {children}
    </>
  )
}
