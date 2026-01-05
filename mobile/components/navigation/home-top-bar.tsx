import { useSafeInsets } from "@/components/ScreenContainer"
import { useAuth } from "@/lib/auth/AuthContext"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { BlurView } from "expo-blur"
import { useRouter } from "expo-router"
import { CreditCardIcon, LogInIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

const TRIGGER_HEIGHT = 50
const EXPAND_DURATION = 250
const COLLAPSE_DURATION = 200
const CONTENT_FADE_IN_DELAY = 200
const CONTENT_FADE_IN_DURATION = 150
const CONTENT_FADE_OUT_DURATION = 100

const BORDER_WIDTH = 1

export function HomeTopBar() {
  const { user, isLoading: authLoading, signOut } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [shouldRenderContent, setShouldRenderContent] = useState(false)
  const measuredHeight = useRef(0)
  const colors = useColors()
  const styles = createStyles(colors)
  const containerHeight = useSharedValue(BORDER_WIDTH)
  const contentOpacity = useSharedValue(0)
  const overlayOpacity = useSharedValue(0)
  const insets = useSafeInsets()
  const router = useRouter()

  // Reset measured height when user changes so we recalculate on next expand
  useEffect(() => {
    measuredHeight.current = 0
  }, [user])

  const handleContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    if (height > 0 && measuredHeight.current === 0) {
      measuredHeight.current = height
      // Now that we have the height, start the animation
      containerHeight.value = withTiming(height + BORDER_WIDTH, {
        duration: EXPAND_DURATION,
        easing: Easing.out(Easing.cubic),
      })
    }
  }

  const handleExpand = () => {
    if (!expanded) {
      setShouldRenderContent(true)
      setExpanded(true)
      // If we already know the height (from previous open), animate immediately
      if (measuredHeight.current > 0) {
        containerHeight.value = withTiming(measuredHeight.current + BORDER_WIDTH, {
          duration: EXPAND_DURATION,
          easing: Easing.out(Easing.cubic),
        })
      }
      // Otherwise, handleContentLayout will trigger the animation after measuring
      contentOpacity.value = withDelay(
        CONTENT_FADE_IN_DELAY,
        withTiming(1, {
          duration: CONTENT_FADE_IN_DURATION,
          easing: Easing.out(Easing.cubic),
        }),
      )
      overlayOpacity.value = withTiming(1, {
        duration: EXPAND_DURATION,
        easing: Easing.out(Easing.cubic),
      })
    } else {
      setExpanded(false)
      containerHeight.value = withDelay(
        CONTENT_FADE_OUT_DURATION,
        withTiming(
          BORDER_WIDTH,
          {
            duration: COLLAPSE_DURATION,
            easing: Easing.out(Easing.cubic),
          },
          (finished) => {
            if (finished) {
              runOnJS(setShouldRenderContent)(false)
            }
          },
        ),
      )
      contentOpacity.value = withTiming(0, {
        duration: CONTENT_FADE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
      })
      overlayOpacity.value = withTiming(0, {
        duration: EXPAND_DURATION,
        easing: Easing.out(Easing.cubic),
      })
    }
  }

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
  }))

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }))

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  return (
    <>
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <Pressable
          onPress={() => {
            if (expanded) {
              handleExpand()
            }
          }}
          style={StyleSheet.absoluteFill}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>
      </Animated.View>
      <View style={[styles.wrapper, { marginTop: -1 * insets.top, paddingTop: insets.top }]}>
        <Pressable
          onPress={handleExpand}
          style={[
            styles.header,
            { height: TRIGGER_HEIGHT },
            expanded && { backgroundColor: colors.background },
          ]}
        >
          <Text style={styles.title}>TOP BAR</Text>
        </Pressable>
        <Animated.View
          style={[
            styles.contentContainer,
            containerAnimatedStyle,
            { top: insets.top + TRIGGER_HEIGHT },
          ]}
        >
          {shouldRenderContent && (
            <Animated.View
              style={[styles.contentInner, contentAnimatedStyle]}
              onLayout={handleContentLayout}
            >
              {user ? (
                <Pressable
                  onPress={() => router.push("/account")}
                  style={({ pressed }) => [styles.linkContent, pressed && { opacity: 0.5 }]}
                >
                  <UserIcon size={22} color={colors.foreground} />
                  <Text style={styles.contentText}>Account</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => router.push("/login")}
                  style={({ pressed }) => [styles.linkContent, pressed && { opacity: 0.5 }]}
                >
                  <LogInIcon size={22} color={colors.foreground} />
                  <Text style={styles.contentText}>Sign In</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => router.push("/settings")}
                style={({ pressed }) => [styles.linkContent, pressed && { opacity: 0.5 }]}
              >
                <SettingsIcon size={22} color={colors.foreground} />
                <Text style={styles.contentText}>Settings</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/premium")}
                style={({ pressed }) => [styles.linkContent, pressed && { opacity: 0.5 }]}
              >
                <CreditCardIcon size={22} color={colors.foreground} />
                <Text style={styles.contentText}>Get Premium</Text>
              </Pressable>
              {user && (
                <Pressable
                  onPress={() => signOut()}
                  style={({ pressed }) => [styles.linkContent, pressed && { opacity: 0.5 }]}
                >
                  <LogOutIcon size={22} color={colors.foreground} />
                  <Text style={styles.contentText}>Sign Out</Text>
                </Pressable>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      position: "relative",
      backgroundColor: colors.background,
      zIndex: 20,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10,
      // backgroundColor: addOpacity(colors.background, 0.75), maybe add back if we need it
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      zIndex: 20,
    },
    title: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.foreground,
    },
    contentContainer: {
      position: "absolute",
      left: 0,
      right: 0,
      overflow: "hidden",
      zIndex: 1,
      borderBottomWidth: 1,
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    contentInner: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      padding: 16,
      flexDirection: "column",
    },
    contentText: {
      color: colors.foreground,
      fontSize: 18,
      fontWeight: "500",
    },
    linkContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 16,
      width: "100%",
    },
  })
