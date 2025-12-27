import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native"

import { useLandscapeOrientation } from "@/hooks/useLandscapeOrientation"
import { usePitchDetection, type DetectedNote } from "@/hooks/usePitchDetection"
import { frequencyMatchesNote, HOLD_DURATION_MS } from "@/utils/pitchUtils"
import { fretboardScreenStyles as shared } from "@/utils/sharedStyles"
import { theme } from "@/utils/theme"
import {
  ARPEGGIO_LABELS,
  ARPEGGIO_SHORT_LABELS,
  ARPEGGIO_TYPES,
  findOrCreateArpeggioBoxForFret,
  Fretboard,
  getArpeggioBoxPositions,
  getArpeggioNotes,
  getArpeggioPositions,
  getArpeggioPositionsWithWrap,
  getOctaveAtPosition,
  NOTES,
  type ArpeggioBoxPosition,
  type ArpeggioType,
  type NoteName,
} from "../../components/fretboard"

// Delay after completing all positions before next arpeggio (ms)
const NEXT_ARPEGGIO_DELAY_MS = 2000

function getRandomRoot(): NoteName {
  const index = Math.floor(Math.random() * NOTES.length)
  return NOTES[index]
}

function getRandomArpeggioType(): ArpeggioType {
  const index = Math.floor(Math.random() * ARPEGGIO_TYPES.length)
  return ARPEGGIO_TYPES[index]
}

type Mode = "manual" | "practice"
type ViewMode = "full" | "position"

export default function Arpeggio() {
  const router = useRouter()
  const { showRotatePrompt, rotateToLandscape, rotateToPortrait } = useLandscapeOrientation()
  const [mode, setMode] = useState<Mode>("manual")
  const [viewMode, setViewMode] = useState<ViewMode>("full")
  const [selectedRoot, setSelectedRoot] = useState<NoteName>("C")
  const [selectedArpeggioType, setSelectedArpeggioType] = useState<ArpeggioType>("major7")
  const [currentBox, setCurrentBox] = useState<ArpeggioBoxPosition | null>(null)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [showArpeggioPicker, setShowArpeggioPicker] = useState(false)
  const [animateTransition, setAnimateTransition] = useState(false)
  const viewModeTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Practice mode state
  const [isPracticing, setIsPracticing] = useState(false)
  const [practiceRoot, setPracticeRoot] = useState<NoteName | null>(null)
  const [practiceArpeggioType, setPracticeArpeggioType] = useState<ArpeggioType | null>(null)
  const [practiceBox, setPracticeBox] = useState<ArpeggioBoxPosition | null>(null)
  const [playedPositions, setPlayedPositions] = useState<
    Array<{ stringIndex: number; fret: number }>
  >([])
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Track which note+octave combinations have been played
  const playedOctavesRef = useRef<Set<string>>(new Set())
  // Hold duration tracking
  const holdStartRef = useRef<{ note: NoteName; octave: number; startTime: number } | null>(null)

  // Get the current practice arpeggio positions for detection
  const practiceArpeggioPositions = useMemo(() => {
    if (!practiceRoot || !practiceArpeggioType || !practiceBox) return []
    return getArpeggioPositionsWithWrap(
      practiceRoot,
      practiceArpeggioType,
      practiceBox.startFret,
      practiceBox.endFret,
      undefined, // tuning (use default)
      undefined, // maxFret (use default)
      practiceBox.rootFret,
      practiceBox.rootStringIndex,
    )
  }, [practiceRoot, practiceArpeggioType, practiceBox])

  // Handle detected notes from pitch detection
  const handleNoteDetected = useCallback(
    (detected: DetectedNote) => {
      if (!isPracticing || !practiceRoot || !practiceArpeggioType || isTransitioning || practiceArpeggioPositions.length === 0)
        return

      // Get the arpeggio notes for the current root and type
      const arpeggioNotes = getArpeggioNotes(practiceRoot, practiceArpeggioType)

      // Check if the detected note is in the arpeggio
      if (!arpeggioNotes.includes(detected.note)) {
        holdStartRef.current = null
        return
      }

      // Check if the frequency matches a note in the arpeggio at a valid octave
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

          // Find positions in the current arpeggio box that match this note+octave
          const matchingPositions = practiceArpeggioPositions.filter((pos) => {
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
              if (currentPlayed.length >= practiceArpeggioPositions.length) {
                // All positions played! Start transition
                setIsTransitioning(true)

                setTimeout(() => {
                  // Select new random root, type, and box
                  const newRoot = getRandomRoot()
                  const newArpeggioType = getRandomArpeggioType()
                  const newBoxPositions = getArpeggioBoxPositions(newRoot)
                  const randomBoxIndex = Math.floor(Math.random() * newBoxPositions.length)
                  const newBox = newBoxPositions[randomBoxIndex]

                  setPracticeRoot(newRoot)
                  setPracticeArpeggioType(newArpeggioType)
                  setPracticeBox(newBox)
                  playedOctavesRef.current.clear()
                  holdStartRef.current = null
                  setPlayedPositions([])
                  setIsTransitioning(false)
                }, NEXT_ARPEGGIO_DELAY_MS)
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
    [isPracticing, practiceRoot, practiceArpeggioType, isTransitioning, practiceArpeggioPositions],
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
      setPracticeArpeggioType(null)
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
      setPracticeArpeggioType(null)
      setPracticeBox(null)
      setPlayedPositions([])
      playedOctavesRef.current.clear()
      holdStartRef.current = null
      setIsTransitioning(false)
    } else {
      // Start practicing - select random root, type, and box
      const root = getRandomRoot()
      const arpeggioType = getRandomArpeggioType()
      const boxPositions = getArpeggioBoxPositions(root)
      const randomBoxIndex = Math.floor(Math.random() * boxPositions.length)
      const box = boxPositions[randomBoxIndex]

      setPracticeRoot(root)
      setPracticeArpeggioType(arpeggioType)
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
    }, 250)
  }

  const handleFretPress = (_stringIndex: number, fret: number, note: NoteName) => {
    if (mode === "manual") {
      if (viewMode === "position") {
        // In position view, find or create a valid box for this fret and note
        const { box } = findOrCreateArpeggioBoxForFret(fret, note)
        setSelectedRoot(note)
        setCurrentBox(box)
      } else {
        // In full view, clicking a fret sets that note as the root
        setSelectedRoot(note)
      }
    }
  }

  // Get available box positions for the selected root
  const boxPositions = useMemo(() => getArpeggioBoxPositions(selectedRoot), [selectedRoot])

  // Use the stored currentBox, or fall back to the first box position
  const activeBox = currentBox ?? boxPositions[0]

  // Get arpeggio positions based on view mode
  const arpeggioPositions = useMemo(() => {
    if (viewMode === "full") {
      return getArpeggioPositions(selectedRoot, selectedArpeggioType)
    }
    // Position view - filter to the selected box range (with wrapping support)
    // Pass rootFret to prefer positions closer to the root note
    if (activeBox) {
      return getArpeggioPositionsWithWrap(
        selectedRoot,
        selectedArpeggioType,
        activeBox.startFret,
        activeBox.endFret,
        undefined, // tuning (use default)
        undefined, // maxFret (use default)
        activeBox.rootFret,
        activeBox.rootStringIndex,
      )
    }
    return getArpeggioPositions(selectedRoot, selectedArpeggioType)
  }, [selectedRoot, selectedArpeggioType, viewMode, activeBox])

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
            {/* Current arpeggio display */}
            <View style={styles.arpeggioDisplay}>
              <Text style={styles.arpeggioDisplayText}>
                {selectedRoot}{ARPEGGIO_SHORT_LABELS[selectedArpeggioType]}
              </Text>
            </View>

            {/* Note selector */}
            <View style={shared.noteSelectContainer}>
              <Pressable
                style={shared.noteSelect}
                onPress={() => {
                  setShowNotePicker(!showNotePicker)
                  setShowArpeggioPicker(false)
                }}
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

            {/* Arpeggio type selector */}
            <View style={shared.noteSelectContainer}>
              <Pressable
                style={shared.noteSelect}
                onPress={() => {
                  setShowArpeggioPicker(!showArpeggioPicker)
                  setShowNotePicker(false)
                }}
              >
                <Text style={styles.noteSelectLabel}>Type:</Text>
                <Text style={shared.noteSelectText}>{ARPEGGIO_SHORT_LABELS[selectedArpeggioType]}</Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </Pressable>
              {showArpeggioPicker && (
                <ScrollView style={styles.arpeggioPicker}>
                  {ARPEGGIO_TYPES.map((type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.arpeggioPickerItem,
                        selectedArpeggioType === type && styles.arpeggioPickerItemActive,
                      ]}
                      onPress={() => {
                        setSelectedArpeggioType(type)
                        setShowArpeggioPicker(false)
                      }}
                    >
                      <Text
                        style={[
                          styles.arpeggioPickerItemText,
                          selectedArpeggioType === type && styles.arpeggioPickerItemTextActive,
                        ]}
                      >
                        {ARPEGGIO_LABELS[type]}
                      </Text>
                      <Text style={styles.arpeggioPickerItemSymbol}>
                        {ARPEGGIO_SHORT_LABELS[type]}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
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
            {/* Current arpeggio display during practice */}
            {practiceRoot && practiceArpeggioType && practiceBox && (
              <View style={[styles.arpeggioDisplay, isTransitioning && styles.transitionDisplay]}>
                <Text style={styles.arpeggioDisplayLabel}>{isTransitioning ? "Nice!" : "Play:"}</Text>
                <Text style={[styles.arpeggioDisplayText, isTransitioning && styles.transitionText]}>
                  {practiceRoot}{ARPEGGIO_SHORT_LABELS[practiceArpeggioType]}
                </Text>
                <Text style={styles.progressText}>
                  {isTransitioning
                    ? "Next..."
                    : `${playedPositions.length}/${practiceArpeggioPositions.length}`}
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
                ? practiceArpeggioPositions
                : [] // Empty when practice mode but not started
              : arpeggioPositions
          }
          successPositions={mode === "practice" && isPracticing ? playedPositions : []}
          scalePracticeMode={mode === "practice" && isPracticing}
          animateTransition={animateTransition}
        />
      </View>
    </View>
  )
}

// Arpeggio-specific styles (extends shared fretboard screen styles)
const styles = StyleSheet.create({
  arpeggioDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8b5cf622",
    borderColor: "#8b5cf6",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  arpeggioDisplayText: {
    color: "#8b5cf6",
    fontSize: 16,
    fontWeight: "bold",
  },
  arpeggioDisplayLabel: {
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
    backgroundColor: "#8b5cf633",
  },
  notePickerItemText: {
    color: theme.colors.primary,
    fontSize: 14,
  },
  notePickerItemTextActive: {
    fontWeight: "600",
    color: "#8b5cf6",
  },
  arpeggioPicker: {
    ...shared.notePicker,
    width: 180,
    maxHeight: 200,
  },
  arpeggioPickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  arpeggioPickerItemActive: {
    backgroundColor: "#8b5cf633",
  },
  arpeggioPickerItemText: {
    color: theme.colors.primary,
    fontSize: 14,
  },
  arpeggioPickerItemTextActive: {
    fontWeight: "600",
    color: "#8b5cf6",
  },
  arpeggioPickerItemSymbol: {
    color: theme.colors.mutedForeground,
    fontSize: 12,
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
    backgroundColor: "#8b5cf633",
    borderColor: "#8b5cf6",
    borderWidth: 2,
  },
  transitionText: {
    color: "#8b5cf6",
  },
  progressText: {
    ...shared.progressText,
    marginLeft: 8,
  },
})
