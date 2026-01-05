import { AuthProvider } from "@/lib/auth/AuthContext"
import { ThemeProvider } from "@/lib/theme/ThemeContext"
import { TRPCProvider } from "@/lib/trpc/react"
import { Stack } from "expo-router"

export default function RootLayout() {
  return (
    <ThemeProvider>
      <TRPCProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </TRPCProvider>
    </ThemeProvider>
  )
}
