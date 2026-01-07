import Button from "@/components/ui/button"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { useRouter } from "expo-router"
import { ChevronLeftIcon } from "lucide-react-native"
import React from "react"
import { StyleSheet, Text, View } from "react-native"
interface NavTopBarProps {
  title?: string
  edges?: Array<"top" | "bottom" | "left" | "right">
}

export default function NavTopBar({ title, edges }: NavTopBarProps) {
  const colors = useColors()
  const styles = createStyles(colors)
  const router = useRouter()
  const widthPct = (edges?.includes("left") ? 2.5 : 0) + (edges?.includes("right") ? 2.5 : 0)
  return (
    <View
      style={[
        styles.container,
        {
          marginTop: edges?.includes("top") ? 0 : 16,
          width: `${widthPct + 100}%`,
          left: 0,
        },
      ]}
    >
      <Button variant="ghost" size="icon" style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeftIcon size={24} color={colors.foreground} />
      </Button>
      <Text style={styles.title}>{title}</Text>
    </View>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: "relative",
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 20,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    backButton: {
      position: "absolute",
      left: 0,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      paddingLeft: 16,
      paddingRight: 16,
      width: 48,
      paddingVertical: 25.5,
    },
    title: {
      marginBlock: 16,
      fontSize: 16,
      fontWeight: "bold",
      color: colors.foreground,
    },
  })
