import { AuthProvider } from "@/lib/auth/AuthContext"
import { ThemeProvider } from "@/lib/theme/ThemeContext"
import { TRPCProvider } from "@/lib/trpc/react"
import { Stack } from "expo-router"
import { SafeAreaProvider } from "react-native-safe-area-context"

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <TRPCProvider>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </TRPCProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
