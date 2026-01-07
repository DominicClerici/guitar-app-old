import { Fretboard } from "@/components/fretboard/fretboard"
import { ScreenContainer } from "@/components/ScreenContainer"
import { buttonVariants } from "@/components/ui/button"
import { NoteName } from "@/lib/audio/utils"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { useLocalSearchParams } from "expo-router"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react-native"
import React, { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

export type ScaleType = "major"

export type ScalePracticeParams = {
  scale: ScaleType
  key: NoteName
  showNotes: "true" | "false"
}

const EXAMPLE_NOTES = [
  {
    type: "note-disabled" as const,
    fretIndex: 0, // nut
    stringIndex: 0, // bottom string (Low E string)
    label: "E",
  },
  {
    type: "note" as const,
    fretIndex: 3, // 3rd fret
    stringIndex: 1, // 2nd string (A string)
    label: "C",
  },
]

export default function PracticePage() {
  const colors = useColors()
  const styles = createStyles(colors)
  const { scale, key, showNotes } = useLocalSearchParams<ScalePracticeParams>()

  const [startFret, setStartFret] = useState([0, 5])

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.fretboardContainer}>
          <View style={styles.fretboardControlsRow}>
            <View style={styles.fretboardControlButtonContainer}>
              <Pressable
                style={buttonVariants(colors, { variant: "outline", size: "default" }).button}
                onPress={() => setStartFret([startFret[0] - 1, startFret[1] - 1])}
                disabled={startFret[0] <= 0}
              >
                <ChevronLeftIcon size={20} color={colors.foreground} />
              </Pressable>
              <Text style={styles.fretboardControlText}>{startFret[0]}</Text>
            </View>
            <View style={styles.fretboardControlButtonContainer}>
              <Text style={styles.fretboardControlText}>{startFret[1]}</Text>

              <Pressable
                style={buttonVariants(colors, { variant: "outline", size: "default" }).button}
                onPress={() => setStartFret([startFret[0] + 1, startFret[1] + 1])}
                disabled={startFret[1] >= 22}
              >
                <ChevronRightIcon size={20} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
          <Fretboard
            startFret={startFret[0]}
            endFret={startFret[1]}
            widthPercent={95}
            heightPercent={30}
            markers={EXAMPLE_NOTES}
          />
        </View>
      </View>
    </ScreenContainer>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingInline: "2.5%",
      backgroundColor: colors.background,
    },
    fretboardContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    fretboardControlsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 12,
    },
    fretboardControlButton: {
      width: 40,
      height: 40,
      padding: 0,
    },
    fretboardControlText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    fretboardControlButtonContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
  })
