import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native"

import { useLandscapeOrientation } from "@/hooks/useLandscapeOrientation"
import { usePitchDetection, type DetectedNote } from "@/hooks/usePitchDetection"
import { frequencyMatchesNote, HOLD_DURATION_MS } from "@/utils/pitchUtils"
import { fretboardScreenStyles as shared } from "@/utils/sharedStyles"
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

// Delay after completing all positions before next note (ms)
const NEXT_SCALE_DELAY_MS = 2000

function getRandomRoot(): NoteName {
  const index = Math.floor(Math.random() * NOTES.length)
  return NOTES[index]
}

type Mode = "manual" | "practice"
type ViewMode = "full" | "position"

export default function Scales() {
  const router = useRouter()
  const { showRotatePrompt, rotateToLandscape, rotateToPortrait } = useLandscapeOrientation()
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (viewModeTransitionTimeoutRef.current) {
        clearTimeout(viewModeTransitionTimeoutRef.current)
      }
    }
  }, [])

  const handleBack = async () => {
    if (isPracticing) {
      await stopListening()
      setIsPracticing(false)
    }
    await rotateToPortrait()
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

  if (showRotatePrompt) {
    return (
      <View style={shared.rotateContainer}>
        <Ionicons
          name="phone-landscape-outline"
          size={80}
          color="#007AFF"
          style={shared.rotateIcon}
        />
        <Text style={shared.rotateTitle}>Rotate Your Phone</Text>
        <Text style={shared.rotateSubtitle}>The fretboard works best in landscape mode</Text>
        <Pressable style={shared.rotateButton} onPress={rotateToLandscape}>
          <Text style={shared.rotateButtonText}>Rotate for Me</Text>
        </Pressable>
      </View>
    )
  }

  // Show fretboard view
  return (
    <View style={shared.container}>
      {/* Controls row */}
      <View style={shared.controlsRow}>
        {/* Back button */}
        <TouchableOpacity style={shared.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Mode toggle */}
        <View style={shared.modeToggle}>
          <Pressable
            style={[shared.modeButton, mode === "manual" && shared.modeButtonActive]}
            onPress={() => handleModeChange("manual")}
          >
            <Text style={[shared.modeButtonText, mode === "manual" && shared.modeButtonTextActive]}>
              Manual
            </Text>
          </Pressable>
          <Pressable
            style={[shared.modeButton, mode === "practice" && shared.modeButtonActive]}
            onPress={() => handleModeChange("practice")}
          >
            <Text
              style={[shared.modeButtonText, mode === "practice" && shared.modeButtonTextActive]}
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
            <View style={shared.noteSelectContainer}>
              <Pressable
                style={shared.noteSelect}
                onPress={() => setShowNotePicker(!showNotePicker)}
              >
                <Text style={styles.noteSelectLabel}>Root:</Text>
                <Text style={shared.noteSelectText}>{selectedRoot}</Text>
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
            <View style={shared.modeToggle}>
              <Pressable
                style={[shared.modeButton, viewMode === "full" && shared.modeButtonActive]}
                onPress={() => handleViewModeChange("full")}
              >
                <Text
                  style={[
                    shared.modeButtonText,
                    viewMode === "full" && shared.modeButtonTextActive,
                  ]}
                >
                  Full
                </Text>
              </Pressable>
              <Pressable
                style={[shared.modeButton, viewMode === "position" && shared.modeButtonActive]}
                onPress={() => handleViewModeChange("position")}
              >
                <Text
                  style={[
                    shared.modeButtonText,
                    viewMode === "position" && shared.modeButtonTextActive,
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
          <View style={shared.practiceControls}>
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
              style={[shared.startButton, isPracticing && shared.stopButton]}
              onPress={handleStartPractice}
            >
              <Text style={shared.startButtonText}>{isPracticing ? "Stop" : "Start"}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Fretboard */}
      <View style={shared.fretboardContainer}>
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

// Scale-specific styles (extends shared fretboard screen styles)
const styles = StyleSheet.create({
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
  scaleDisplayLabel: {
    color: theme.colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  noteSelectLabel: {
    color: theme.colors.mutedForeground,
    fontSize: 14,
  },
  notePicker: {
    ...shared.notePicker,
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
  transitionDisplay: {
    backgroundColor: "#22c55e33",
    borderColor: "#22c55e",
    borderWidth: 2,
  },
  transitionText: {
    color: "#22c55e",
  },
  progressText: {
    ...shared.progressText,
    marginLeft: 8,
  },
})
