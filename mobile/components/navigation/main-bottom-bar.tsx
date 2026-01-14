import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { BarChartIcon, HomeIcon, PlayIcon, SettingsIcon } from "lucide-react-native"
import React, { useState } from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import Animated, {
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
  onPress,
  colors,
  styles,
}: {
  tab: Tab
  isActive: boolean
  onPress: () => void
  colors: ThemeColors
  styles: ReturnType<typeof createStyles>
}) {
  const textWidth = useSharedValue(0)

  const animatedContainerStyle = useAnimatedStyle(() => ({
    width: withTiming(isActive ? textWidth.value : 0, { duration: 250 }),
    opacity: withTiming(isActive ? 1 : 0.2, { duration: 250 }),
  }))

  return (
    <TouchableOpacity style={styles.tab} onPress={onPress}>
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
    </TouchableOpacity>
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
    href: "/home",
  },
  {
    label: "Stats",
    icon: BarChartIcon,
    href: "/stats",
  },
  {
    label: "Practice",
    icon: PlayIcon,
    href: "/practice",
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    href: "/settings",
  },
]

export default function MainBottomBar() {
  const colors = useColors()
  const styles = createStyles(colors)
  //   const router = useRouter()
  //   const pathname = usePathname()
  const [activeIndex, setActiveIndex] = useState(0)

  const indicatorX = useSharedValue(0)
  const indicatorWidth = useSharedValue(0)

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(indicatorX.value, { damping: 93, stiffness: 1000 }) }],
    width: withSpring(indicatorWidth.value, { damping: 93, stiffness: 1000 }),
  }))

  const handleMeasure = (index: number, layout: IndicatorLayout) => {
    if (index === activeIndex) {
      indicatorX.value = layout.x
      indicatorWidth.value = layout.width
    }
  }

  const handleTabPress = (index: number) => {
    setActiveIndex(index)
  }

  return (
    <View style={styles.container}>
      <HiddenMeasureTabs
        tabs={TABS}
        activeIndex={activeIndex}
        onMeasure={handleMeasure}
        colors={colors}
        styles={styles}
      />
      <View style={styles.tabContainer}>
        <Animated.View style={[styles.indicator, animatedIndicatorStyle]} />
        {TABS.map((tab, index) => {
          const isActive = index === activeIndex
          return (
            <TabItem
              key={tab.href}
              tab={tab}
              isActive={isActive}
              onPress={() => handleTabPress(index)}
              colors={colors}
              styles={styles}
            />
          )
        })}
      </View>
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
