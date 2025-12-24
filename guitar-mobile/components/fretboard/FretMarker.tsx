import * as Haptics from "expo-haptics"
import { Pressable, StyleSheet, Text, View } from "react-native"

import type { NoteName } from "./fretboardData"

export interface FretMarkerProps {
  stringIndex: number
  fret: number
  note: NoteName
  showNote?: boolean
  isHighlighted?: boolean
  isCorrect?: boolean
  isIncorrect?: boolean
  onPress?: (stringIndex: number, fret: number, note: NoteName) => void
  width: number
  height: number
}

export function FretMarker({
  stringIndex,
  fret,
  note,
  showNote = false,
  isHighlighted = false,
  isCorrect = false,
  isIncorrect = false,
  onPress,
  width,
  height,
}: FretMarkerProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.(stringIndex, fret, note)
  }

  // Responsive marker size based on available space
  const markerSize = Math.min(width * 0.7, height * 0.7, 32)
  const fontSize = Math.max(markerSize * 0.45, 10)

  const markerStyle = [
    styles.marker,
    {
      width: markerSize,
      height: markerSize,
      borderRadius: markerSize / 2,
    },
    isHighlighted && styles.highlighted,
    isCorrect && styles.correct,
    isIncorrect && styles.incorrect,
  ]

  return (
    <Pressable
      style={[styles.container, { width, height }]}
      onPress={handlePress}
    >
      {(showNote || isHighlighted || isCorrect || isIncorrect) && (
        <View style={markerStyle}>
          <Text style={[styles.noteText, { fontSize }]}>{note}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  marker: {
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  highlighted: {
    backgroundColor: "#007AFF",
  },
  correct: {
    backgroundColor: "#34C759",
  },
  incorrect: {
    backgroundColor: "#FF3B30",
  },
  noteText: {
    color: "#fff",
    fontWeight: "bold",
  },
})
