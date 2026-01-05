import { HomeTopBar } from "@/components/navigation/home-top-bar"
import { ScreenContainer } from "@/components/ScreenContainer"
import { buttonVariants } from "@/components/ui/button"
import DarkSelector from "@/components/ui/dark-selector"
import { useAuth } from "@/lib/auth/AuthContext"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { trpc } from "@/lib/trpc/react"
import { Link } from "expo-router"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"

export default function HomeScreen() {
  const colors = useColors()
  const styles = createStyles(colors)
  const { user, signOut, isLoading: authLoading } = useAuth()

  const { data: userInfo, isLoading: userInfoLoading } = trpc.user.getUserInfo.useQuery(undefined, {
    enabled: !!user,
  })

  const handleSignOut = async () => {
    await signOut()
  }

  if (authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    )
  }

  return (
    <ScreenContainer>
      <HomeTopBar />
      <View style={styles.container}>
        <Text style={styles.title}>Hello World</Text>
        <DarkSelector />
        {user ? (
          <>
            <Text style={styles.subtitle}>
              Username: {userInfoLoading ? "Loading..." : userInfo?.name || "No name"}
            </Text>

            <Pressable
              style={buttonVariants(colors, { variant: "outline", size: "lg" }).button}
              onPress={handleSignOut}
            >
              <Text style={buttonVariants(colors, { variant: "outline", size: "lg" }).text}>
                Sign Out
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>You are logged out</Text>
            <Link
              href="/login"
              style={buttonVariants(colors, { variant: "outline", size: "lg" }).button}
            >
              <Text style={buttonVariants(colors, { variant: "outline", size: "lg" }).text}>
                Login
              </Text>
            </Link>
            <Link
              href="/sign-up"
              style={buttonVariants(colors, { variant: "outline", size: "lg" }).button}
            >
              <Text style={buttonVariants(colors, { variant: "outline", size: "lg" }).text}>
                Sign Up
              </Text>
            </Link>
          </>
        )}
      </View>
    </ScreenContainer>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: colors.mutedForeground,
      marginBottom: 30,
    },
  })
