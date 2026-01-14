import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { usePathname, useRouter } from "expo-router"
import { BarChartIcon, HomeIcon, PlayIcon, SettingsIcon } from "lucide-react-native"
import React, { useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

type Tab = {
  label: string
  icon: typeof HomeIcon
  href: string
}

type IndicatorLayout = { x: number; width: number }

const ICON_SIZE = 24

function TabItem({
  tab,
  isActive,
  colors,
  styles,
  onLayout,
}: {
  tab: Tab
  isActive: boolean
  colors: ThemeColors
  styles: ReturnType<typeof createStyles>
  onLayout?: (layout: { x: number; width: number }) => void
}) {
  const textWidth = useSharedValue(0)

  const animatedContainerStyle = useAnimatedStyle(() => ({
    width: withTiming(isActive ? textWidth.value : 0, { duration: 250 }),
    opacity: withTiming(isActive ? 1 : 0.2, { duration: 250 }),
  }))

  return (
    <View
      style={styles.tab}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout
        onLayout?.({ x, width })
      }}
    >
      <tab.icon
        size={ICON_SIZE}
        color={isActive ? colors.primaryForeground : colors.foreground}
        style={styles.tabIcon}
      />
      <View style={styles.hiddenMeasure} pointerEvents="none">
        <Animated.Text
          style={[styles.tabLabel]}
          onLayout={(e) => {
            textWidth.value = e.nativeEvent.layout.width
          }}
        >
          {tab.label}
        </Animated.Text>
      </View>
      <Animated.View style={[styles.labelContainer, animatedContainerStyle]}>
        <Animated.Text
          ellipsizeMode="clip"
          numberOfLines={1}
          style={[
            styles.tabLabel,
            { color: isActive ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </View>
  )
}

function HiddenMeasureTabs({
  tabs,
  activeIndex,
  onMeasure,
  colors,
  styles,
}: {
  tabs: Tab[]
  activeIndex: number
  onMeasure: (index: number, layout: IndicatorLayout) => void
  colors: ThemeColors
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.hiddenTabContainer} pointerEvents="none">
      {tabs.map((tab, index) => {
        const isActive = index === activeIndex
        return (
          <View
            key={tab.href}
            style={styles.tab}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout
              onMeasure(index, { x, width })
            }}
          >
            <tab.icon size={ICON_SIZE} color={colors.foreground} style={styles.tabIcon} />
            {isActive && <Text style={styles.tabLabel}>{tab.label}</Text>}
          </View>
        )
      })}
    </View>
  )
}

const TABS: Tab[] = [
  {
    label: "Home",
    icon: HomeIcon,
    href: "/(bottomNav)",
  },
  {
    label: "Stats",
    icon: BarChartIcon,
    href: "/(bottomNav)/stats",
  },
  {
    label: "Practice",
    icon: PlayIcon,
    href: "/(bottomNav)/practice",
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    href: "/(bottomNav)/settings",
  },
]

export default function MainBottomBar() {
  const colors = useColors()
  const styles = createStyles(colors)
  const router = useRouter()
  const pathname = usePathname()
  const [activeIndex, setActiveIndex] = useState(
    TABS.findIndex((tab) => tab.href === pathname) ?? 0,
  )
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const tabLayouts = useRef<{ x: number; width: number }[]>([])

  const indicatorX = useSharedValue(0)
  const indicatorWidth = useSharedValue(0)

  const displayIndex = draggingIndex ?? activeIndex

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(indicatorX.value, { damping: 93, stiffness: 1000 }) }],
    width: withSpring(indicatorWidth.value, { damping: 93, stiffness: 1000 }),
  }))

  const handleMeasure = (index: number, layout: IndicatorLayout) => {
    if (index === displayIndex) {
      indicatorX.value = layout.x
      indicatorWidth.value = layout.width
    }
  }

  const handleTabLayout = (index: number, layout: { x: number; width: number }) => {
    tabLayouts.current[index] = layout
  }

  const getTabIndexFromX = (x: number): number => {
    for (let i = 0; i < tabLayouts.current.length; i++) {
      const tab = tabLayouts.current[i]
      if (tab && x >= tab.x && x < tab.x + tab.width) {
        return i
      }
    }
    if (x < 0) return 0
    return TABS.length - 1
  }

  const handleDragUpdate = (x: number) => {
    const tabIndex = getTabIndexFromX(x)
    setDraggingIndex(tabIndex)
  }

  const handleDragEnd = (x: number) => {
    const tabIndex = getTabIndexFromX(x)
    setActiveIndex(tabIndex)
    setDraggingIndex(null)
    router.replace(TABS[tabIndex].href as any)
  }

  const handleDragCancel = () => {
    setDraggingIndex(null)
  }

  const panGesture = Gesture.Pan()
    .onStart((e: { x: number }) => {
      runOnJS(handleDragUpdate)(e.x)
    })
    .onUpdate((e: { x: number }) => {
      runOnJS(handleDragUpdate)(e.x)
    })
    .onEnd((e: { x: number }) => {
      runOnJS(handleDragEnd)(e.x)
    })
    .onFinalize(() => {
      runOnJS(handleDragCancel)()
    })

  const tapGesture = Gesture.Tap().onEnd((e: { x: number }) => {
    runOnJS(handleDragEnd)(e.x)
  })

  const composedGesture = Gesture.Race(panGesture, tapGesture)

  return (
    <View style={styles.container}>
      <HiddenMeasureTabs
        tabs={TABS}
        activeIndex={displayIndex}
        onMeasure={handleMeasure}
        colors={colors}
        styles={styles}
      />
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.tabContainer}>
          <Animated.View style={[styles.indicator, animatedIndicatorStyle]} />
          {TABS.map((tab, index) => {
            const isActive = index === displayIndex
            return (
              <TabItem
                key={tab.href}
                tab={tab}
                isActive={isActive}
                colors={colors}
                styles={styles}
                onLayout={(layout) => handleTabLayout(index, layout)}
              />
            )
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      height: 64,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 8,
      borderRadius: 32,
      position: "absolute",
      bottom: 16,
      left: 16,
      right: 16,
      zIndex: 1000,
    },
    hiddenTabContainer: {
      position: "absolute",
      top: 8,
      left: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      opacity: 0,
    },
    tabContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    tab: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      height: 48,
      paddingHorizontal: 12,
      borderRadius: 24,
      flexDirection: "row",
    },
    indicator: {
      position: "absolute",
      height: 48,
      backgroundColor: colors.primary,
      borderRadius: 24,
    },
    tabFrame: {
      flexGrow: 1,
    },
    tabIcon: {
      marginBottom: 4,
    },
    labelContainer: {
      overflow: "hidden",
    },
    hiddenMeasure: {
      position: "absolute",
      opacity: 0,
      pointerEvents: "none",
    },
    tabLabel: {
      paddingLeft: 4,
      fontSize: 14,
      fontWeight: "600",
      color: colors.foreground,
      lineHeight: 14,
      overflow: "hidden",
    },
  })
