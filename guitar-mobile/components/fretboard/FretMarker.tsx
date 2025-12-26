import { useEffect, useRef } from "react"
import { Animated, StyleSheet, Text, View } from "react-native"

import { theme } from "@/utils/theme"
import type { NoteName } from "./fretboardData"

export interface FretMarkerProps {
  note: NoteName
  isHighlighted?: boolean
  isHint?: boolean
  width: number
  height: number
  isRoot?: boolean
  isSuccess?: boolean
  displayText?: string // Optional override for what to display (e.g., interval "1", "2", etc.)
  animateTransition?: boolean // Whether to animate in/out (for view mode changes)
}

export function FretMarker({
  note,
  isHighlighted = false,
  isHint = false,
  width,
  height,
  isRoot = false,
  isSuccess = false,
  displayText,
  animateTransition = false,
}: FretMarkerProps) {
  // Animation values for scale and opacity
  const scaleAnim = useRef(new Animated.Value(1)).current
  const opacityAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Animate in when mounting with animateTransition
    if (animateTransition) {
      scaleAnim.setValue(0.8)
      opacityAnim.setValue(0)
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [animateTransition, scaleAnim, opacityAnim])

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
    isRoot && styles.root,
    isHint && styles.hint,
    isSuccess && styles.success,
  ]

  return (
    <View style={[styles.container, { width, height }]}>
      <Animated.View
        style={[
          markerStyle,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text
          style={[
            styles.noteText,
            isHighlighted && styles.highlightedNoteText,
            isRoot && styles.rootNoteText,
            isSuccess && styles.successNoteText,
            { fontSize },
          ]}
        >
          {displayText ?? note}
        </Text>
      </Animated.View>
    </View>
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
    backgroundColor: theme.colors.muted,
    borderColor: theme.colors.mutedForeground,
    borderWidth: 1,
  },
  root: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primary,
    borderWidth: 2,
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
    color: theme.colors.mutedForeground,
  },
  rootNoteText: {
    color: theme.colors.primary,
  },
  success: {
    backgroundColor: "#22c55e22",
    borderColor: "#22c55e",
    borderWidth: 2,
  },
  successNoteText: {
    color: "#22c55e",
  },
})
