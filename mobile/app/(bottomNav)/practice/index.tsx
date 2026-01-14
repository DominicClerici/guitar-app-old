import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import React from "react"
import { StyleSheet, Text, View } from "react-native"

export default function PracticeScreen() {
  const colors = useColors()
  const styles = createStyles(colors)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coming soon: Practice screen</Text>
    </View>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    title: {
      color: colors.foreground,
      fontSize: 24,
      fontWeight: "bold",
    },
  })
