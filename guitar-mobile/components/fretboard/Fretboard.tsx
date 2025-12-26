import * as Haptics from "expo-haptics"
import { useRef, useState } from "react"
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"

import { theme } from "@/utils/theme"
import { FretMarker } from "./FretMarker"
import {
  DOUBLE_DOT_FRETS,
  FRET_COUNT,
  getNoteAtPosition,
  type NoteName,
  type ScalePosition,
  SINGLE_DOT_FRETS,
  STANDARD_TUNING,
} from "./fretboardData"

interface VisibleMarker {
  stringIndex: number
  fret: number
  note: NoteName
  isHighlighted: boolean
  isHint: boolean
  isRoot: boolean
  isSuccess: boolean
  displayText?: string
}

export interface FretboardProps {
  tuning?: NoteName[]
  fretCount?: number
  startFret?: number // For position view - show frets starting from this fret (default: 1)
  showAllNotes?: boolean
  highlightedPositions?: Array<{ stringIndex: number; fret: number }>
  hintPositions?: Array<{ stringIndex: number; fret: number }>
  correctPositions?: Array<{ stringIndex: number; fret: number }>
  rootPositions?: Array<{ stringIndex: number; fret: number }> // Positions to show as root notes
  scalePositions?: ScalePosition[] // For scale mode - shows intervals instead of notes
  successPositions?: Array<{ stringIndex: number; fret: number }> // Positions that have been successfully played
  scalePracticeMode?: boolean // When true, unhit scale positions show as hints instead of highlighted
  onFretPress?: (stringIndex: number, fret: number, note: NoteName) => void
  animateTransition?: boolean // Whether to animate marker visibility changes
}

export function Fretboard({
  tuning = STANDARD_TUNING,
  fretCount = FRET_COUNT,
  startFret = 1,
  showAllNotes = false,
  highlightedPositions = [],
  hintPositions = [],
  correctPositions = [],
  rootPositions = [],
  scalePositions = [],
  successPositions = [],
  scalePracticeMode = false,
  onFretPress,
  animateTransition = false,
}: FretboardProps) {
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null)
  const lastPositionRef = useRef<{ stringIndex: number; fret: number } | null>(null)

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainerSize({ width, height })
  }

  const stringCount = tuning.length

  // Calculate visible fret range
  const visibleFretCount = fretCount - startFret + 1
  const showNut = startFret === 1

  // Use container size for dimensions
  const availableWidth = containerSize?.width ?? 0
  const availableHeight = containerSize?.height ?? 0

  // Nut width scales with screen size (only show if starting from fret 1)
  const nutWidth = showNut ? Math.min(40, availableWidth * 0.05) : 0
  // When not showing nut, show fret number label area instead
  const fretLabelWidth = showNut ? 0 : Math.min(40, availableWidth * 0.05)
  const fretboardWidth = availableWidth - nutWidth - fretLabelWidth

  // Calculate fret width and string spacing
  // String spacing is the gap between strings. With half spacing at top/bottom,
  // we have (stringCount - 1) full gaps + 2 half gaps = stringCount total gaps worth of space
  const fretWidth = fretboardWidth / visibleFretCount
  const stringSpacing = availableHeight / stringCount

  // Responsive element sizes based on available space
  const dotSize = Math.min(stringSpacing * 0.3, fretWidth * 0.2, 12)
  const fretWireWidth = Math.max(2, availableHeight * 0.008)
  const nutBorderWidth = Math.max(3, availableHeight * 0.012)
  const fontSize = Math.min(stringSpacing * 0.5, 14)
  const fretNumberFontSize = Math.min(12, availableHeight * 0.05)

  // Build a list of only the markers that need to be rendered
  // This avoids rendering 72 FretMarker components when only ~20 are visible
  const visibleMarkers: VisibleMarker[] = []
  const seenPositions = new Set<string>()

  const addMarker = (
    stringIndex: number,
    fret: number,
    flags: { isHighlighted?: boolean; isHint?: boolean; isRoot?: boolean; isSuccess?: boolean; displayText?: string }
  ) => {
    // Only include markers within the visible fret range
    if (fret < startFret || fret > fretCount) return

    const key = `${stringIndex}-${fret}`
    if (seenPositions.has(key)) return
    seenPositions.add(key)

    visibleMarkers.push({
      stringIndex,
      fret,
      note: getNoteAtPosition(stringIndex, fret, tuning),
      isHighlighted: flags.isHighlighted ?? false,
      isHint: flags.isHint ?? false,
      isRoot: flags.isRoot ?? false,
      isSuccess: flags.isSuccess ?? false,
      displayText: flags.displayText,
    })
  }

  // Create a Set for quick success position lookups
  const successPositionSet = new Set(
    successPositions.map((p) => `${p.stringIndex}-${p.fret}`)
  )

  // Add scale positions (with degree display text)
  // When scalePracticeMode is true:
  // - Unhit positions show as hints (grayed out)
  // - Hit positions show as success (green)
  for (const pos of scalePositions) {
    const isSuccess = successPositionSet.has(`${pos.stringIndex}-${pos.fret}`)

    // In practice mode, show unhit positions as hints (except roots which stay visible)
    const showAsHint = scalePracticeMode && !isSuccess && !pos.isRoot

    addMarker(pos.stringIndex, pos.fret, {
      isHighlighted: !showAsHint,
      isHint: showAsHint,
      isRoot: pos.isRoot && !showAsHint,
      isSuccess,
      displayText: String(pos.degree),
    })
  }

  // Add highlighted positions (includes correct positions)
  for (const pos of highlightedPositions) {
    addMarker(pos.stringIndex, pos.fret, { isHighlighted: true })
  }
  for (const pos of correctPositions) {
    addMarker(pos.stringIndex, pos.fret, { isHighlighted: true })
  }

  // Add hint positions
  for (const pos of hintPositions) {
    addMarker(pos.stringIndex, pos.fret, { isHint: true })
  }

  // Add root positions
  for (const pos of rootPositions) {
    addMarker(pos.stringIndex, pos.fret, { isRoot: true })
  }

  // If showAllNotes is true, add all positions
  if (showAllNotes) {
    for (let stringIndex = 0; stringIndex < stringCount; stringIndex++) {
      for (let fret = startFret; fret <= fretCount; fret++) {
        addMarker(stringIndex, fret, { isHighlighted: true })
      }
    }
  }

  // Convert stringIndex to visual Y position (reversed: high e at top, low E at bottom)
  const getVisualStringPosition = (stringIndex: number) => stringCount - 1 - stringIndex

  // Format open string note for display (lowercase 'e' for high E string)
  const formatOpenStringNote = (note: NoteName, stringIndex: number) =>
    stringIndex === stringCount - 1 ? note.toLowerCase() : note

  // Calculate string and fret from touch coordinates (relative to fretboard surface)
  const getPositionFromCoordinates = (x: number, y: number) => {
    if (!containerSize) return null

    // x is relative to fretboard surface (after nut/label area)
    const fret = Math.floor(x / fretWidth) + startFret
    // Visual position from Y coordinate, then convert to stringIndex (reversed)
    const visualPosition = Math.floor(y / stringSpacing)
    const stringIndex = stringCount - 1 - visualPosition

    // Clamp values to valid range
    const clampedFret = Math.max(startFret, Math.min(fret, fretCount))
    const clampedStringIndex = Math.max(0, Math.min(stringIndex, stringCount - 1))

    return { stringIndex: clampedStringIndex, fret: clampedFret }
  }

  const handlePositionChange = (stringIndex: number, fret: number) => {
    const note = getNoteAtPosition(stringIndex, fret, tuning)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onFretPress?.(stringIndex, fret, note)
  }

  // Calculate left offset for touch handling (nut or fret label area)
  const leftOffset = nutWidth + fretLabelWidth

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart((event) => {
      // Adjust x to account for nut/label width
      const x = event.x - leftOffset
      const position = getPositionFromCoordinates(x, event.y)
      if (position) {
        lastPositionRef.current = position
        handlePositionChange(position.stringIndex, position.fret)
      }
    })
    .onUpdate((event) => {
      // Adjust x to account for nut/label width
      const x = event.x - leftOffset
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
            style={[
              styles.fretboard,
              { width: fretboardWidth + nutWidth + fretLabelWidth, height: availableHeight },
            ]}
          >
            {/* Fret label area (when not showing nut) */}
            {!showNut && (
              <View style={[styles.fretLabelArea, { width: fretLabelWidth, height: availableHeight }]}>
                <Text style={[styles.fretLabelText, { fontSize }]}>{startFret}</Text>
              </View>
            )}

            {/* Nut (the bar at the end of the fretboard near the headstock) */}
            {showNut && (
              <View
                style={[
                  styles.nut,
                  { width: nutWidth, height: availableHeight, borderRightWidth: nutBorderWidth },
                ]}
              >
                {tuning.map((note, stringIndex) => (
                  <View
                    key={`open-${stringIndex}`}
                    style={[
                      styles.openStringContainer,
                      {
                        position: "absolute",
                        top: getVisualStringPosition(stringIndex) * stringSpacing,
                        height: stringSpacing,
                        width: nutWidth,
                      },
                    ]}
                  >
                    <Text style={[styles.openStringText, { fontSize }]}>
                      {formatOpenStringNote(note, stringIndex)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Fretboard surface */}
            <View
              style={[styles.fretboardSurface, { width: fretboardWidth, height: availableHeight }]}
            >
              {/* Fret markers (dots) */}
              <View style={styles.fretMarkersContainer}>
                {Array.from({ length: visibleFretCount }, (_, i) => i + startFret).map((fret) => {
                  const isSingleDot = SINGLE_DOT_FRETS.includes(fret)
                  const isDoubleDot = DOUBLE_DOT_FRETS.includes(fret)
                  // Center dot in the middle of the fret (between fret-1 wire and fret wire)
                  // Adjust position relative to startFret
                  const left = (fret - startFret + 0.5) * fretWidth - dotSize / 2

                  const dotStyle = {
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    backgroundColor: theme.colors.accent,
                  }

                  if (isSingleDot) {
                    return (
                      <View
                        key={`dot-${fret}`}
                        style={[styles.fretDotSingle, dotStyle, { left }]}
                      />
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
              {Array.from({ length: visibleFretCount }, (_, i) => i + startFret).map((fret) => (
                <View
                  key={`fret-${fret}`}
                  style={[
                    styles.fretWire,
                    {
                      left: (fret - startFret + 1) * fretWidth - fretWireWidth / 2,
                      height: availableHeight,
                      width: fretWireWidth,
                    },
                  ]}
                />
              ))}

              {/* Strings */}
              {tuning.map((_, stringIndex) => {
                // String thickness - thicker strings at bottom (low E), thinner at top (high e)
                const thickness = 1 + (stringCount - 1 - stringIndex) * 0.5
                const visualPosition = getVisualStringPosition(stringIndex)
                return (
                  <View
                    key={`string-${stringIndex}`}
                    style={[
                      styles.string,
                      {
                        top: stringSpacing / 2 + visualPosition * stringSpacing - thickness / 2,
                        width: fretboardWidth,
                        height: thickness,
                      },
                    ]}
                  />
                )
              })}

              {/* Visible fret markers - only render markers that should be displayed */}
              {visibleMarkers.map((marker) => {
                const left = (marker.fret - startFret) * fretWidth
                const top = getVisualStringPosition(marker.stringIndex) * stringSpacing

                return (
                  <View
                    key={`pos-${marker.stringIndex}-${marker.fret}`}
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
                      note={marker.note}
                      isHighlighted={marker.isHighlighted}
                      isHint={marker.isHint}
                      isRoot={marker.isRoot}
                      isSuccess={marker.isSuccess}
                      displayText={marker.displayText}
                      width={fretWidth}
                      height={stringSpacing}
                      animateTransition={animateTransition}
                    />
                  </View>
                )
              })}
            </View>

            {/* Fret numbers */}
            <View
              style={[
                styles.fretNumbers,
                {
                  width: fretboardWidth,
                  left: nutWidth + fretLabelWidth,
                  bottom: -fretNumberFontSize * 1.5,
                },
              ]}
            >
              {Array.from({ length: visibleFretCount }, (_, i) => i + startFret).map((fret) => (
                <View
                  key={`num-${fret}`}
                  style={[styles.fretNumberContainer, { width: fretWidth }]}
                >
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
    borderTopColor: theme.colors.muted,
    borderTopWidth: 1,
    borderBottomColor: theme.colors.muted,
    borderBottomWidth: 1,
    position: "relative",
  },
  nut: {
    borderRightColor: theme.colors.muted,
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 10,
  },
  fretLabelArea: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  fretLabelText: {
    color: theme.colors.muted,
    fontWeight: "bold",
  },
  openStringContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  openStringText: {
    color: theme.colors.muted,
    fontWeight: "bold",
  },
  fretboardSurface: {
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
    backgroundColor: theme.colors.accent,
  },
  string: {
    position: "absolute",
    backgroundColor: theme.colors.mutedForeground,
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
    color: theme.colors.muted,
  },
})
