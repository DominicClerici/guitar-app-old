import HomeHeader from "@/components/navigation/home/home-header"
import React from "react"

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <HomeHeader />
      {children}
    </main>
  )
}
