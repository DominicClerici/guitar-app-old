import { ScreenContainer } from "@/components/ScreenContainer"
import { buttonVariants } from "@/components/ui/button"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { Link } from "expo-router"
import React from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

export default function ScalesScreen() {
  const colors = useColors()
  const styles = createStyles(colors)
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text>ScalesScreen</Text>
        <Link
          href={{
            pathname: "/scales/practice",
            params: {
              key: "C",
              scale: "major",
              showNotes: "true",
            },
          }}
          asChild
        >
          <Pressable style={buttonVariants(colors, { variant: "outline", size: "lg" }).button}>
            <Text style={buttonVariants(colors, { variant: "outline", size: "lg" }).text}>
              Major
            </Text>
          </Pressable>
        </Link>
        {/* <Link
          href={{
            pathname: "/scales/practice",
            params: {
              key: "C",
              scale: "minor",
              showNotes: "true",
            },
          }}
          asChild
        >
          <Pressable style={buttonVariants(colors, { variant: "outline", size: "lg" }).button}>
            <Text style={buttonVariants(colors, { variant: "outline", size: "lg" }).text}>
              Minor
            </Text>
          </Pressable>
        </Link> */}
      </View>
    </ScreenContainer>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
  })
