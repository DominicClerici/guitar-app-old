import LandingHeader from "@/components/navigation/home/landing-header"
import React from "react"

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <LandingHeader />
      {children}
    </main>
  )
}
