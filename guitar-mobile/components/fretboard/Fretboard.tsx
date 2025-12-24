import * as Haptics from "expo-haptics"
import { useRef, useState } from "react"
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"

import { FretMarker } from "./FretMarker"
import {
  DOUBLE_DOT_FRETS,
  FRET_COUNT,
  getNoteAtPosition,
  type NoteName,
  SINGLE_DOT_FRETS,
  STANDARD_TUNING,
} from "./fretboardData"

export interface FretboardProps {
  tuning?: NoteName[]
  fretCount?: number
  showAllNotes?: boolean
  highlightedPositions?: Array<{ stringIndex: number; fret: number }>
  correctPositions?: Array<{ stringIndex: number; fret: number }>
  incorrectPositions?: Array<{ stringIndex: number; fret: number }>
  onFretPress?: (stringIndex: number, fret: number, note: NoteName) => void
}

export function Fretboard({
  tuning = STANDARD_TUNING,
  fretCount = FRET_COUNT,
  showAllNotes = false,
  highlightedPositions = [],
  correctPositions = [],
  incorrectPositions = [],
  onFretPress,
}: FretboardProps) {
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const lastPositionRef = useRef<{ stringIndex: number; fret: number } | null>(null)

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainerSize({ width, height })
  }

  const stringCount = tuning.length

  // Use container size for dimensions
  const availableWidth = containerSize?.width ?? 0
  const availableHeight = containerSize?.height ?? 0

  // Nut width scales with screen size
  const nutWidth = Math.min(40, availableWidth * 0.05)
  const fretboardWidth = availableWidth - nutWidth

  // Calculate fret width and string spacing
  const fretWidth = fretboardWidth / fretCount
  const stringSpacing = availableHeight / (stringCount + 1)

  // Responsive element sizes based on available space
  const dotSize = Math.min(stringSpacing * 0.4, fretWidth * 0.3, 14)
  const fretWireWidth = Math.max(2, availableHeight * 0.008)
  const nutBorderWidth = Math.max(3, availableHeight * 0.012)
  const fontSize = Math.min(stringSpacing * 0.5, 14)
  const fretNumberFontSize = Math.min(12, availableHeight * 0.05)

  const isPositionHighlighted = (stringIndex: number, fret: number) =>
    highlightedPositions.some((p) => p.stringIndex === stringIndex && p.fret === fret)

  const isPositionCorrect = (stringIndex: number, fret: number) =>
    correctPositions.some((p) => p.stringIndex === stringIndex && p.fret === fret)

  const isPositionIncorrect = (stringIndex: number, fret: number) =>
    incorrectPositions.some((p) => p.stringIndex === stringIndex && p.fret === fret)

  // Calculate string and fret from touch coordinates (relative to fretboard surface)
  const getPositionFromCoordinates = (x: number, y: number) => {
    if (!containerSize) return null

    // x is relative to fretboard surface (after nut)
    const fret = Math.floor(x / fretWidth) + 1
    const stringIndex = Math.floor(y / stringSpacing)

    // Clamp values to valid range
    const clampedFret = Math.max(1, Math.min(fret, fretCount))
    const clampedStringIndex = Math.max(0, Math.min(stringIndex, stringCount - 1))

    return { stringIndex: clampedStringIndex, fret: clampedFret }
  }

  const handlePositionChange = (stringIndex: number, fret: number) => {
    const note = getNoteAtPosition(stringIndex, fret, tuning)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onFretPress?.(stringIndex, fret, note)
  }

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart((event) => {
      // Adjust x to account for nut width
      const x = event.x - nutWidth
      const position = getPositionFromCoordinates(x, event.y)
      if (position) {
        lastPositionRef.current = position
        handlePositionChange(position.stringIndex, position.fret)
      }
    })
    .onUpdate((event) => {
      // Adjust x to account for nut width
      const x = event.x - nutWidth
      const position = getPositionFromCoordinates(x, event.y)
      if (position) {
        const last = lastPositionRef.current
        // Only trigger if position changed
        if (!last || last.stringIndex !== position.stringIndex || last.fret !== position.fret) {
          lastPositionRef.current = position
          handlePositionChange(position.stringIndex, position.fret)
        }
      }
    })
    .onEnd(() => {
      lastPositionRef.current = null
    })

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {containerSize && (
        <GestureDetector gesture={panGesture}>
          <View
            style={[styles.fretboard, { width: fretboardWidth + nutWidth, height: availableHeight }]}
          >
          {/* Nut (the bar at the end of the fretboard near the headstock) */}
          <View
            style={[
              styles.nut,
              { width: nutWidth, height: availableHeight, borderRightWidth: nutBorderWidth },
            ]}
          >
            {tuning.map((note, index) => (
              <View
                key={`open-${index}`}
                style={[
                  styles.openStringContainer,
                  {
                    position: "absolute",
                    top: (index + 1) * stringSpacing - stringSpacing / 2,
                    height: stringSpacing,
                    width: nutWidth,
                  },
                ]}
              >
                <Text style={[styles.openStringText, { fontSize }]}>{note}</Text>
              </View>
            ))}
          </View>

          {/* Fretboard surface */}
          <View
            style={[styles.fretboardSurface, { width: fretboardWidth, height: availableHeight }]}
          >
            {/* Fret markers (dots) */}
            <View style={styles.fretMarkersContainer}>
              {Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => {
                const isSingleDot = SINGLE_DOT_FRETS.includes(fret)
                const isDoubleDot = DOUBLE_DOT_FRETS.includes(fret)
                // Center dot in the middle of the fret (between fret-1 wire and fret wire)
                const left = (fret - 0.5) * fretWidth - dotSize / 2

                const dotStyle = {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: "#d4d4d4",
                }

                if (isSingleDot) {
                  return (
                    <View key={`dot-${fret}`} style={[styles.fretDotSingle, dotStyle, { left }]} />
                  )
                }
                if (isDoubleDot) {
                  return (
                    <View
                      key={`dot-${fret}`}
                      style={[styles.doubleDotContainer, { left, width: dotSize }]}
                    >
                      <View style={dotStyle} />
                      <View style={dotStyle} />
                    </View>
                  )
                }
                return null
              })}
            </View>

            {/* Fret wires */}
            {Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => (
              <View
                key={`fret-${fret}`}
                style={[
                  styles.fretWire,
                  {
                    left: fret * fretWidth - fretWireWidth / 2,
                    height: availableHeight,
                    width: fretWireWidth,
                  },
                ]}
              />
            ))}

            {/* Strings */}
            {tuning.map((_, stringIndex) => {
              // String thickness - thicker strings at top (low E), thinner at bottom (high E)
              const thickness = 1 + (stringCount - 1 - stringIndex) * 0.5
              return (
                <View
                  key={`string-${stringIndex}`}
                  style={[
                    styles.string,
                    {
                      top: (stringIndex + 1) * stringSpacing - thickness / 2,
                      width: fretboardWidth,
                      height: thickness,
                    },
                  ]}
                />
              )
            })}

            {/* Interactive fret positions */}
            {tuning.map((_, stringIndex) =>
              Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => {
                const note = getNoteAtPosition(stringIndex, fret, tuning)
                // Center the marker in the middle of the fret (between fret-1 wire and fret wire)
                const left = (fret - 1) * fretWidth
                const top = (stringIndex + 1) * stringSpacing - stringSpacing / 2

                return (
                  <View
                    key={`pos-${stringIndex}-${fret}`}
                    style={[
                      styles.fretPosition,
                      {
                        left,
                        top,
                        width: fretWidth,
                        height: stringSpacing,
                      },
                    ]}
                  >
                    <FretMarker
                      stringIndex={stringIndex}
                      fret={fret}
                      note={note}
                      showNote={showAllNotes}
                      isHighlighted={isPositionHighlighted(stringIndex, fret)}
                      isCorrect={isPositionCorrect(stringIndex, fret)}
                      isIncorrect={isPositionIncorrect(stringIndex, fret)}
                      onPress={onFretPress}
                      width={fretWidth}
                      height={stringSpacing}
                    />
                  </View>
                )
              }),
            )}
          </View>

          {/* Fret numbers */}
          <View
            style={[
              styles.fretNumbers,
              { width: fretboardWidth, left: nutWidth, bottom: -fretNumberFontSize * 1.5 },
            ]}
          >
            {Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => (
              <View key={`num-${fret}`} style={[styles.fretNumberContainer, { width: fretWidth }]}>
                <Text style={[styles.fretNumberText, { fontSize: fretNumberFontSize }]}>
                  {fret}
                </Text>
              </View>
            ))}
          </View>
        </View>
        </GestureDetector>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fretboard: {
    flexDirection: "row",
    position: "relative",
  },
  nut: {
    backgroundColor: "#f5f5dc",
    borderRightColor: "#8B4513",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 10,
  },
  openStringContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  openStringText: {
    color: "#333",
    fontWeight: "bold",
  },
  fretboardSurface: {
    backgroundColor: "#3d2817",
    position: "relative",
  },
  fretMarkersContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fretDotSingle: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: "-50%" }],
  },
  doubleDotContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  fretWire: {
    position: "absolute",
    backgroundColor: "#c0c0c0",
  },
  string: {
    position: "absolute",
    backgroundColor: "#d4af37",
    left: 0,
  },
  fretPosition: {
    position: "absolute",
  },
  fretNumbers: {
    position: "absolute",
    flexDirection: "row",
  },
  fretNumberContainer: {
    alignItems: "center",
  },
  fretNumberText: {
    color: "#888",
  },
})
