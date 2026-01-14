import { buttonVariants } from "@/components/ui/button"
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
    <>
      <View style={styles.container}>
        <Text style={styles.title}>
          {userInfo?.name ? (
            <>
              Hello, {`\n`}
              <Text style={{ color: colors.primary }}>{userInfo?.name}</Text>
            </>
          ) : (
            <>
              Welcome to <Text style={{ color: colors.primary }}>GuitarFlow</Text>
            </>
          )}
        </Text>
        <Link style={styles.tunerButton} href="/tuner">
          <Text style={styles.tunerButtonText}>Tuner</Text>
        </Link>

        {user ? (
          <Pressable
            style={buttonVariants(colors, { variant: "outline", size: "lg" }).button}
            onPress={handleSignOut}
          >
            <Text style={buttonVariants(colors, { variant: "outline", size: "lg" }).text}>
              Sign Out
            </Text>
          </Pressable>
        ) : (
          <>
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

        <Link
          style={buttonVariants(colors, { variant: "outline", size: "lg" }).button}
          href="/scales"
        >
          <Text style={buttonVariants(colors, { variant: "outline", size: "lg" }).text}>Tuner</Text>
        </Link>
      </View>
    </>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: "25%",
      gap: 16,
    },
    title: {
      color: colors.foreground,
      fontSize: 38,
      fontWeight: "bold",
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: colors.mutedForeground,
      marginBottom: 30,
    },
    tunerButton: {
      marginTop: "20%",
      height: "25%",
      backgroundColor: colors.backgroundElevated,
      borderRadius: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tunerButtonText: {
      color: colors.foreground,
      fontSize: 32,
      fontWeight: "bold",
      textAlign: "right",
    },
  })
