import { useColors } from "@/lib/theme/ThemeContext"
import { ReactNode } from "react"
import { StyleProp, View, ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface ScreenContainerProps {
  children: ReactNode
  /** Override which edges get safe area padding. Defaults to ['top', 'bottom'] */
  edges?: Array<"top" | "bottom" | "left" | "right">
  /** Additional style for the outer container (controls background in unsafe areas) */
  style?: StyleProp<ViewStyle>
  /** Additional style for the inner content container */
  contentStyle?: StyleProp<ViewStyle>
}

export function ScreenContainer({
  children,
  edges = ["top", "bottom"],
  style,
  contentStyle,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets()
  const colors = useColors()

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      <View
        style={[
          {
            flex: 1,
            paddingTop: edges.includes("top") ? insets.top : 0,
            paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
            paddingLeft: edges.includes("left") ? insets.left : 0,
            paddingRight: edges.includes("right") ? insets.right : 0,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  )
}
