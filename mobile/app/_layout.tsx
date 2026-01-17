import { AuthProvider } from "@/lib/auth/AuthContext"
import { ThemeProvider } from "@/lib/theme/ThemeContext"
import { TRPCProvider } from "@/lib/trpc/react"
import { Stack, usePathname } from "expo-router"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

export default function RootLayout() {
  const pathname = usePathname()
  console.log("pathname", pathname)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <TRPCProvider>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </AuthProvider>
          </TRPCProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
