import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as ScreenOrientation from "expo-screen-orientation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native"

import { usePitchDetection, type DetectedNote } from "@/hooks/usePitchDetection"
import { theme } from "@/utils/theme"
import {
  findOrCreateBoxForFret,
  Fretboard,
  getOctaveAtPosition,
  getScaleBoxPositions,
  getScaleNotes,
  getScalePositions,
  getScalePositionsWithWrap,
  NOTES,
  type NoteName,
  type ScaleBoxPosition,
} from "../../components/fretboard"

// A4 reference frequency for calculating note frequencies
const A4_FREQUENCY = 440
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

// Frequency tolerance for note detection (±5%)
const FREQUENCY_TOLERANCE = 0.05
// How long a note must be held to register (ms)
const HOLD_DURATION_MS = 50
// Delay after completing all positions before next note (ms)
const NEXT_SCALE_DELAY_MS = 2000

/**
 * Calculate the frequency of a note at a given octave
 */
function getNoteFrequency(note: NoteName, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(note)
  if (noteIndex === -1) return 0
  // A4 is at index 9, octave 4
  const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9)
  return A4_FREQUENCY * Math.pow(2, semitonesFromA4 / 12)
}

/**
 * Check if a detected frequency matches a target note within tolerance
 * Returns the octave if matched, or null if not matched
 */
function frequencyMatchesNote(
  detectedFrequency: number,
  targetNote: NoteName,
  tolerancePercent: number = FREQUENCY_TOLERANCE,
): number | null {
  // Check octaves 2-6 (typical guitar range)
  for (let octave = 2; octave <= 6; octave++) {
    const targetFreq = getNoteFrequency(targetNote, octave)
    const minFreq = targetFreq * (1 - tolerancePercent)
    const maxFreq = targetFreq * (1 + tolerancePercent)

    if (detectedFrequency >= minFreq && detectedFrequency <= maxFreq) {
      return octave
    }
  }
  return null
}

function getRandomRoot(): NoteName {
  const index = Math.floor(Math.random() * NOTES.length)
  return NOTES[index]
}

type Mode = "manual" | "practice"
type ViewMode = "full" | "position"

export default function Scales() {
  const router = useRouter()
  const [isLandscape, setIsLandscape] = useState(false)
  const [hasEnteredLandscape, setHasEnteredLandscape] = useState(false)
  const [mode, setMode] = useState<Mode>("manual")
  const [viewMode, setViewMode] = useState<ViewMode>("full")
  const [selectedRoot, setSelectedRoot] = useState<NoteName>("C")
  const [currentBox, setCurrentBox] = useState<ScaleBoxPosition | null>(null)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [animateTransition, setAnimateTransition] = useState(false)
  const viewModeTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Practice mode state
  const [isPracticing, setIsPracticing] = useState(false)
  const [practiceRoot, setPracticeRoot] = useState<NoteName | null>(null)
  const [practiceBox, setPracticeBox] = useState<ScaleBoxPosition | null>(null)
  const [playedPositions, setPlayedPositions] = useState<
    Array<{ stringIndex: number; fret: number }>
  >([])
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Track which note+octave combinations have been played
  const playedOctavesRef = useRef<Set<string>>(new Set())
  // Hold duration tracking
  const holdStartRef = useRef<{ note: NoteName; octave: number; startTime: number } | null>(null)

  // Get the current practice scale positions for detection
  const practiceScalePositions = useMemo(() => {
    if (!practiceRoot || !practiceBox) return []
    return getScalePositionsWithWrap(
      practiceRoot,
      "major",
      practiceBox.startFret,
      practiceBox.endFret,
    )
  }, [practiceRoot, practiceBox])

  // Handle detected notes from pitch detection
  const handleNoteDetected = useCallback(
    (detected: DetectedNote) => {
      if (!isPracticing || !practiceRoot || isTransitioning || practiceScalePositions.length === 0)
        return

      // Get the scale notes for the current root
      const scaleNotes = getScaleNotes(practiceRoot, "major")

      // Check if the detected note is in the scale
      if (!scaleNotes.includes(detected.note)) {
        holdStartRef.current = null
        return
      }

      // Check if the frequency matches a note in the scale at a valid octave
      const matchedOctave = frequencyMatchesNote(detected.frequency, detected.note)
      if (matchedOctave === null) {
        holdStartRef.current = null
        return
      }

      const now = Date.now()
      const octaveKey = `${detected.note}${matchedOctave}`

      // Skip if we've already registered this octave
      if (playedOctavesRef.current.has(octaveKey)) {
        return
      }

      // Check if we're continuing to hold the same note+octave
      if (
        holdStartRef.current &&
        holdStartRef.current.note === detected.note &&
        holdStartRef.current.octave === matchedOctave
      ) {
        const heldDuration = now - holdStartRef.current.startTime

        if (heldDuration >= HOLD_DURATION_MS) {
          // Note held long enough - register it!
          playedOctavesRef.current.add(octaveKey)

          // Find positions in the current scale box that match this note+octave
          const matchingPositions = practiceScalePositions.filter((pos) => {
            const posOctave = getOctaveAtPosition(pos.stringIndex, pos.fret)
            return pos.note === detected.note && posOctave === matchedOctave
          })

          // Add these positions to played positions
          setPlayedPositions((prev) => {
            const newPositions = [...prev]
            for (const pos of matchingPositions) {
              const exists = newPositions.some(
                (p) => p.stringIndex === pos.stringIndex && p.fret === pos.fret,
              )
              if (!exists) {
                newPositions.push({ stringIndex: pos.stringIndex, fret: pos.fret })
              }
            }
            return newPositions
          })

          holdStartRef.current = null

          // Check if all positions have been played
          setTimeout(() => {
            setPlayedPositions((currentPlayed) => {
              if (currentPlayed.length >= practiceScalePositions.length) {
                // All positions played! Start transition
                setIsTransitioning(true)

                setTimeout(() => {
                  // Select new random root and box
                  const newRoot = getRandomRoot()
                  const newBoxPositions = getScaleBoxPositions(newRoot)
                  const randomBoxIndex = Math.floor(Math.random() * newBoxPositions.length)
                  const newBox = newBoxPositions[randomBoxIndex]

                  setPracticeRoot(newRoot)
                  setPracticeBox(newBox)
                  playedOctavesRef.current.clear()
                  holdStartRef.current = null
                  setPlayedPositions([])
                  setIsTransitioning(false)
                }, NEXT_SCALE_DELAY_MS)
              }
              return currentPlayed
            })
          }, 100)
        }
      } else {
        // Started holding a new note+octave
        holdStartRef.current = {
          note: detected.note,
          octave: matchedOctave,
          startTime: now,
        }
      }
    },
    [isPracticing, practiceRoot, isTransitioning, practiceScalePositions],
  )

  const { startListening, stopListening } = usePitchDetection({
    bufferSize: 4096,
    minVolume: -70,
    updateIntervalMs: 25,
    onNoteDetected: handleNoteDetected,
  })

  useEffect(() => {
    let subscription: ScreenOrientation.Subscription | null = null

    const setup = async () => {
      // Check initial orientation
      const orientation = await ScreenOrientation.getOrientationAsync()
      const landscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      setIsLandscape(landscape)
      if (landscape) {
        setHasEnteredLandscape(true)
      }

      // Listen for orientation changes
      subscription = ScreenOrientation.addOrientationChangeListener((event) => {
        const newOrientation = event.orientationInfo.orientation
        const newLandscape =
          newOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          newOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
        setIsLandscape(newLandscape)
        if (newLandscape) {
          setHasEnteredLandscape(true)
        }
      })
    }

    setup()

    return () => {
      if (subscription) {
        ScreenOrientation.removeOrientationChangeListener(subscription)
      }
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (viewModeTransitionTimeoutRef.current) {
        clearTimeout(viewModeTransitionTimeoutRef.current)
      }
    }
  }, [])

  const handleRotateToLandscape = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT)
    setHasEnteredLandscape(true)
  }

  const handleBack = async () => {
    // Stop practicing if active
    if (isPracticing) {
      await stopListening()
      setIsPracticing(false)
    }
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
    router.back()
  }

  const handleModeChange = async (newMode: Mode) => {
    // Stop practicing when switching modes
    if (isPracticing) {
      await stopListening()
      setIsPracticing(false)
      setPracticeRoot(null)
      setPracticeBox(null)
      setPlayedPositions([])
      playedOctavesRef.current.clear()
      holdStartRef.current = null
      setIsTransitioning(false)
    }
    setMode(newMode)
  }

  const handleStartPractice = async () => {
    if (isPracticing) {
      // Stop practicing
      await stopListening()
      setIsPracticing(false)
      setPracticeRoot(null)
      setPracticeBox(null)
      setPlayedPositions([])
      playedOctavesRef.current.clear()
      holdStartRef.current = null
      setIsTransitioning(false)
    } else {
      // Start practicing - select random root and box
      const root = getRandomRoot()
      const boxPositions = getScaleBoxPositions(root)
      const randomBoxIndex = Math.floor(Math.random() * boxPositions.length)
      const box = boxPositions[randomBoxIndex]

      setPracticeRoot(root)
      setPracticeBox(box)
      setPlayedPositions([])
      playedOctavesRef.current.clear()
      holdStartRef.current = null
      setIsTransitioning(false)
      await startListening()
      setIsPracticing(true)
    }
  }

  const handleViewModeChange = (newViewMode: ViewMode) => {
    if (newViewMode === viewMode) return

    // Clear any existing timeout
    if (viewModeTransitionTimeoutRef.current) {
      clearTimeout(viewModeTransitionTimeoutRef.current)
    }

    // Enable animation for view mode transitions
    setAnimateTransition(true)
    setViewMode(newViewMode)

    // Disable animation after the transition completes
    viewModeTransitionTimeoutRef.current = setTimeout(() => {
      setAnimateTransition(false)
    }, 250) // Slightly longer than the 200ms animation
  }

  const handleFretPress = (_stringIndex: number, fret: number, note: NoteName) => {
    if (mode === "manual") {
      if (viewMode === "position") {
        // In position view, find or create a valid box for this fret and note
        const { box } = findOrCreateBoxForFret(fret, note)
        setSelectedRoot(note)
        setCurrentBox(box)
      } else {
        // In full view, clicking a fret sets that note as the root
        setSelectedRoot(note)
      }
    }
  }

  // Get available box positions for the selected root (used for initial state)
  const boxPositions = useMemo(() => getScaleBoxPositions(selectedRoot), [selectedRoot])

  // Use the stored currentBox, or fall back to the first box position
  const activeBox = currentBox ?? boxPositions[0]

  // Get scale positions based on view mode
  const scalePositions = useMemo(() => {
    if (viewMode === "full") {
      return getScalePositions(selectedRoot, "major")
    }
    // Position view - filter to the selected box range (with wrapping support)
    if (activeBox) {
      return getScalePositionsWithWrap(
        selectedRoot,
        "major",
        activeBox.startFret,
        activeBox.endFret,
      )
    }
    return getScalePositions(selectedRoot, "major")
  }, [selectedRoot, viewMode, activeBox])

  // Show rotate prompt if not in landscape and hasn't entered landscape yet
  if (!isLandscape && !hasEnteredLandscape) {
    return (
      <View style={styles.rotateContainer}>
        <Ionicons
          name="phone-landscape-outline"
          size={80}
          color="#007AFF"
          style={styles.rotateIcon}
        />
        <Text style={styles.rotateTitle}>Rotate Your Phone</Text>
        <Text style={styles.rotateSubtitle}>The fretboard works best in landscape mode</Text>
        <Pressable style={styles.rotateButton} onPress={handleRotateToLandscape}>
          <Text style={styles.rotateButtonText}>Rotate for Me</Text>
        </Pressable>
      </View>
    )
  }

  // Show fretboard view
  return (
    <View style={styles.container}>
      {/* Controls row */}
      <View style={styles.controlsRow}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, mode === "manual" && styles.modeButtonActive]}
            onPress={() => handleModeChange("manual")}
          >
            <Text style={[styles.modeButtonText, mode === "manual" && styles.modeButtonTextActive]}>
              Manual
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === "practice" && styles.modeButtonActive]}
            onPress={() => handleModeChange("practice")}
          >
            <Text
              style={[styles.modeButtonText, mode === "practice" && styles.modeButtonTextActive]}
            >
              Practice
            </Text>
          </Pressable>
        </View>

        {/* Manual mode controls */}
        {mode === "manual" && (
          <>
            {/* Current scale display */}
            <View style={styles.scaleDisplay}>
              <Text style={styles.scaleDisplayText}>{selectedRoot} Major</Text>
            </View>

            {/* Note selector */}
            <View style={styles.noteSelectContainer}>
              <Pressable
                style={styles.noteSelect}
                onPress={() => setShowNotePicker(!showNotePicker)}
              >
                <Text style={styles.noteSelectLabel}>Root:</Text>
                <Text style={styles.noteSelectText}>{selectedRoot}</Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </Pressable>
              {showNotePicker && (
                <View style={styles.notePicker}>
                  {NOTES.map((note) => (
                    <Pressable
                      key={note}
                      style={[
                        styles.notePickerItem,
                        selectedRoot === note && styles.notePickerItemActive,
                      ]}
                      onPress={() => {
                        setSelectedRoot(note)
                        setCurrentBox(null) // Reset to default box for new root
                        setShowNotePicker(false)
                      }}
                    >
                      <Text
                        style={[
                          styles.notePickerItemText,
                          selectedRoot === note && styles.notePickerItemTextActive,
                        ]}
                      >
                        {note}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* View mode toggle */}
            <View style={styles.modeToggle}>
              <Pressable
                style={[styles.modeButton, viewMode === "full" && styles.modeButtonActive]}
                onPress={() => handleViewModeChange("full")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    viewMode === "full" && styles.modeButtonTextActive,
                  ]}
                >
                  Full
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, viewMode === "position" && styles.modeButtonActive]}
                onPress={() => handleViewModeChange("position")}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    viewMode === "position" && styles.modeButtonTextActive,
                  ]}
                >
                  Position
                </Text>
              </Pressable>
            </View>

            {/* Position display (only visible in position view mode) */}
            {viewMode === "position" && activeBox && (
              <View style={styles.positionDisplay}>
                <Text style={styles.positionDisplayText}>{activeBox.label}</Text>
                <Text style={styles.positionFretRange}>
                  {activeBox.wraps
                    ? `(Frets ${activeBox.startFret}-12, 1-${activeBox.endFret - 12})`
                    : `(Frets ${activeBox.startFret}-${activeBox.endFret})`}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Practice mode controls */}
        {mode === "practice" && (
          <View style={styles.practiceControls}>
            {/* Current scale display during practice */}
            {practiceRoot && practiceBox && (
              <View style={[styles.scaleDisplay, isTransitioning && styles.transitionDisplay]}>
                <Text style={styles.scaleDisplayLabel}>{isTransitioning ? "Nice!" : "Play:"}</Text>
                <Text style={[styles.scaleDisplayText, isTransitioning && styles.transitionText]}>
                  {practiceRoot} Major
                </Text>
                <Text style={styles.progressText}>
                  {isTransitioning
                    ? "Next..."
                    : `${playedPositions.length}/${practiceScalePositions.length}`}
                </Text>
              </View>
            )}

            {/* Position info */}
            {practiceBox && !isTransitioning && (
              <View style={styles.positionDisplay}>
                <Text style={styles.positionDisplayText}>{practiceBox.label}</Text>
                <Text style={styles.positionFretRange}>
                  {practiceBox.wraps
                    ? `(Frets ${practiceBox.startFret}-12, 1-${practiceBox.endFret - 12})`
                    : `(Frets ${practiceBox.startFret}-${practiceBox.endFret})`}
                </Text>
              </View>
            )}

            {/* Start/Stop button */}
            <Pressable
              style={[styles.startButton, isPracticing && styles.stopButton]}
              onPress={handleStartPractice}
            >
              <Text style={styles.startButtonText}>{isPracticing ? "Stop" : "Start"}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Fretboard */}
      <View style={styles.fretboardContainer}>
        <Fretboard
          onFretPress={mode === "manual" ? handleFretPress : undefined}
          scalePositions={
            mode === "practice"
              ? isPracticing
                ? practiceScalePositions
                : [] // Empty when practice mode but not started
              : scalePositions
          }
          successPositions={mode === "practice" && isPracticing ? playedPositions : []}
          scalePracticeMode={mode === "practice" && isPracticing}
          animateTransition={animateTransition}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingLeft: "7.5%",
    paddingRight: "5%",
    paddingTop: "2%",
    paddingBottom: "2.5%",
  },
  fretboardContainer: {
    flex: 1,
    marginTop: "auto",
    maxHeight: "65%",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: "2%",
  },
  backButton: {
    padding: 8,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.muted,
    borderRadius: 8,
    overflow: "hidden",
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: "#007AFF",
  },
  modeButtonText: {
    color: theme.colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: theme.colors.primary,
  },
  scaleDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#22c55e22",
    borderColor: "#22c55e",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  scaleDisplayText: {
    color: "#22c55e",
    fontSize: 16,
    fontWeight: "bold",
  },
  noteSelectContainer: {
    position: "relative",
  },
  noteSelect: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  noteSelectLabel: {
    color: theme.colors.mutedForeground,
    fontSize: 14,
  },
  noteSelectText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  notePicker: {
    position: "absolute",
    top: "100%",
    left: 0,
    backgroundColor: theme.colors.muted,
    borderRadius: 8,
    marginTop: 4,
    zIndex: 100,
    flexDirection: "row",
    flexWrap: "wrap",
    width: 200,
  },
  notePickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "25%",
    alignItems: "center",
  },
  notePickerItemActive: {
    backgroundColor: "#22c55e33",
  },
  notePickerItemText: {
    color: theme.colors.primary,
    fontSize: 14,
  },
  notePickerItemTextActive: {
    fontWeight: "600",
    color: "#22c55e",
  },
  positionDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  positionDisplayText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  positionFretRange: {
    color: theme.colors.mutedForeground,
    fontSize: 12,
  },
  rotateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    paddingHorizontal: 40,
  },
  rotateIcon: {
    marginBottom: 24,
  },
  rotateTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.primary,
    marginBottom: 12,
  },
  rotateSubtitle: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginBottom: 32,
  },
  rotateButton: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  rotateButtonText: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "600",
  },
  practiceControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scaleDisplayLabel: {
    color: theme.colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  transitionDisplay: {
    backgroundColor: "#22c55e33",
    borderColor: "#22c55e",
    borderWidth: 2,
  },
  transitionText: {
    color: "#22c55e",
  },
  progressText: {
    color: theme.colors.mutedForeground,
    fontSize: 12,
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stopButton: {
    backgroundColor: "#ef4444",
  },
  startButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
})
