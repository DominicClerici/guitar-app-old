import { useSafeInsets } from "@/components/ScreenContainer"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { BlurView } from "expo-blur"
import { Link } from "expo-router"
import { SettingsIcon, UserIcon } from "lucide-react-native"
import { useRef, useState } from "react"
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
  const [expanded, setExpanded] = useState(false)
  const [shouldRenderContent, setShouldRenderContent] = useState(false)
  const measuredHeight = useRef(0)
  const colors = useColors()
  const styles = createStyles(colors)
  const containerHeight = useSharedValue(BORDER_WIDTH)
  const contentOpacity = useSharedValue(0)
  const overlayOpacity = useSharedValue(0)
  const insets = useSafeInsets()

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
              <Link href="/account" style={styles.contentLink}>
                <UserIcon size={24} color={colors.foreground} />
                <Text style={styles.contentText}>Account</Text>
              </Link>
              <Link href="/settings" style={styles.contentLink}>
                <SettingsIcon size={24} color={colors.foreground} />
                <Text style={styles.contentText}>Settings</Text>
              </Link>
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
      gap: 16,
    },
    contentText: {
      color: colors.foreground,
      fontSize: 14,
      lineHeight: 14,
    },
    contentLink: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
  })
