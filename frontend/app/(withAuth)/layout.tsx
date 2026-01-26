import { AuthProvider } from "@/hooks/useAuth"
import React from "react"

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
