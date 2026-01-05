import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
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

const EXPAND_DURATION = 250
const COLLAPSE_DURATION = 200
const CONTENT_FADE_IN_DELAY = 200
const CONTENT_FADE_IN_DURATION = 150
const CONTENT_FADE_OUT_DURATION = 100

export function HomeTopBar() {
  const [expanded, setExpanded] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const measuredHeight = useRef(0)
  const colors = useColors()
  const styles = createStyles(colors)

  const containerHeight = useSharedValue(0)
  const contentOpacity = useSharedValue(0)

  const handleContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    if (height > 0 && measuredHeight.current === 0) {
      measuredHeight.current = height
      // Now that we have the height, start the animation
      containerHeight.value = withTiming(height, {
        duration: EXPAND_DURATION,
        easing: Easing.out(Easing.cubic),
      })
    }
  }

  const handleExpand = () => {
    if (!expanded) {
      setShouldRender(true)
      setExpanded(true)
      // If we already know the height (from previous open), animate immediately
      if (measuredHeight.current > 0) {
        containerHeight.value = withTiming(measuredHeight.current, {
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
    } else {
      setExpanded(false)
      contentOpacity.value = withTiming(0, {
        duration: CONTENT_FADE_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
      })
      containerHeight.value = withDelay(
        CONTENT_FADE_OUT_DURATION,
        withTiming(
          0,
          {
            duration: COLLAPSE_DURATION,
            easing: Easing.in(Easing.cubic),
          },
          (finished) => {
            if (finished) {
              runOnJS(setShouldRender)(false)
            }
          },
        ),
      )
    }
  }

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
  }))

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }))

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={handleExpand} style={styles.header}>
        <Text style={styles.title}>TOP BAR</Text>
      </Pressable>
      {shouldRender && (
        <Animated.View style={[styles.contentContainer, containerAnimatedStyle]}>
          <Animated.View
            style={[styles.contentInner, contentAnimatedStyle]}
            onLayout={handleContentLayout}
          >
            <Text style={styles.contentText}>Content</Text>
            <Text style={styles.contentText}>Content</Text>
            <Text style={styles.contentText}>Content</Text>
            <Text style={styles.contentText}>Content</Text>
            <Text style={styles.contentText}>Content</Text>
            <Text style={styles.contentText}>Content</Text>
            <Text style={styles.contentText}>Content</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      paddingTop: 64,
      marginBottom: 16,
      position: "relative",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.accent,
      borderRadius: 8,
      zIndex: 2,
    },
    title: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.foreground,
    },
    contentContainer: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      backgroundColor: colors.accent,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      overflow: "hidden",
      zIndex: 1,
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
    },
  })
