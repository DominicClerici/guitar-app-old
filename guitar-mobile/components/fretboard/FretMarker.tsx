import * as Haptics from "expo-haptics"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { theme } from "@/utils/theme"
import type { NoteName } from "./fretboardData"

export interface FretMarkerProps {
  stringIndex: number
  fret: number
  note: NoteName
  showNote?: boolean
  isHighlighted?: boolean
  isHint?: boolean
  onPress?: (stringIndex: number, fret: number, note: NoteName) => void
  width: number
  height: number
  isRoot?: boolean
}

export function FretMarker({
  stringIndex,
  fret,
  note,
  showNote = false,
  isHighlighted = false,
  isHint = false,
  onPress,
  width,
  height,
  isRoot = false,
}: FretMarkerProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.(stringIndex, fret, note)
  }

  // Responsive marker size based on available space
  const markerSize = Math.min(width * 0.8, height * 0.8, 32)
  const fontSize = Math.max(markerSize * 0.45, 10)

  const markerStyle = [
    styles.marker,
    {
      width: markerSize,
      height: markerSize,
      borderRadius: markerSize / (isRoot ? 4 : 2),
    },
    isHighlighted && styles.highlighted,
    isHint && styles.hint,
  ]

  return (
    <Pressable style={[styles.container, { width, height }]} onPress={handlePress}>
      {(showNote || isHighlighted || isHint) && (
        <View style={markerStyle}>
          <Text
            style={[styles.noteText, isHighlighted && styles.highlightedNoteText, { fontSize }]}
          >
            {note}
          </Text>
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
    backgroundColor: theme.colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  highlighted: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  hint: {
    backgroundColor: theme.colors.muted,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  noteText: {
    color: theme.colors.mutedForeground,
    fontWeight: "bold",
  },
  highlightedNoteText: {
    color: theme.colors.primary,
  },
})
