import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as ScreenOrientation from "expo-screen-orientation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native"

import { usePitchDetection, type DetectedNote } from "@/hooks/usePitchDetection"
import { theme } from "@/utils/theme"
import {
  Fretboard,
  getPositionsForNote,
  getPositionsForNoteWithOctave,
  NOTES,
  type NoteName,
} from "../../components/fretboard"

type Mode = "manual" | "practice"
const NATURAL_NOTES: NoteName[] = ["A", "B", "C", "D", "E", "F", "G"]

// All 12 notes for random selection in practice mode
const ALL_NOTES = NOTES

// Frequency tolerance for note detection (±5%)
const FREQUENCY_TOLERANCE = 0.05
// How long a note must be held to register (ms)
const HOLD_DURATION_MS = 500
// Delay after completing all positions before next note (ms)
const NEXT_NOTE_DELAY_MS = 2000

// A4 reference frequency for calculating note frequencies
const A4_FREQUENCY = 440
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

function getRandomNote(): NoteName {
  const index = Math.floor(Math.random() * ALL_NOTES.length)
  return ALL_NOTES[index]
}

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
  tolerancePercent: number = FREQUENCY_TOLERANCE
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

export default function NoteTrainer() {
  const router = useRouter()
  const [isLandscape, setIsLandscape] = useState(false)
  const [hasEnteredLandscape, setHasEnteredLandscape] = useState(false)
  const [lastPressedNote, setLastPressedNote] = useState<{
    stringIndex: number
    fret: number
    note: NoteName
  } | null>(null)
  const [mode, setMode] = useState<Mode>("manual")
  const [selectedNote, setSelectedNote] = useState<NoteName>("A")
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  // Practice mode state
  const [isPracticing, setIsPracticing] = useState(false)
  const [practiceNote, setPracticeNote] = useState<NoteName | null>(null)
  const [playedPositions, setPlayedPositions] = useState<Array<{ stringIndex: number; fret: number }>>([])

  // Track which note+octave combinations have been played
  const playedOctavesRef = useRef<Set<string>>(new Set())

  // Hold duration tracking - tracks when the current note started being held
  const holdStartRef = useRef<{ note: NoteName; octave: number; startTime: number } | null>(null)

  // Transition state - when all notes are found, show completion before next note
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Handle detected notes from pitch detection
  const handleNoteDetected = useCallback(
    (detected: DetectedNote) => {
      if (!isPracticing || !practiceNote || isTransitioning) return

      // Use frequency-based matching with tolerance instead of exact note matching
      const matchedOctave = frequencyMatchesNote(detected.frequency, practiceNote)

      if (matchedOctave === null) {
        // Note doesn't match - reset hold tracking
        holdStartRef.current = null
        return
      }

      const now = Date.now()
      const octaveKey = `${practiceNote}${matchedOctave}`

      // Skip if we've already registered this octave
      if (playedOctavesRef.current.has(octaveKey)) {
        return
      }

      // Check if we're continuing to hold the same note+octave
      if (
        holdStartRef.current &&
        holdStartRef.current.note === practiceNote &&
        holdStartRef.current.octave === matchedOctave
      ) {
        // Check if we've held long enough
        const heldDuration = now - holdStartRef.current.startTime

        if (heldDuration >= HOLD_DURATION_MS) {
          // Note held long enough - register it!
          playedOctavesRef.current.add(octaveKey)

          // Get positions for this specific note+octave combination
          const positions = getPositionsForNoteWithOctave(practiceNote, matchedOctave)

          // Add these positions to the played positions
          setPlayedPositions((prev) => {
            const newPositions = [...prev]
            for (const pos of positions) {
              const exists = newPositions.some(
                (p) => p.stringIndex === pos.stringIndex && p.fret === pos.fret
              )
              if (!exists) {
                newPositions.push(pos)
              }
            }
            return newPositions
          })

          // Reset hold tracking for next note
          holdStartRef.current = null

          // Check if all positions have been played
          const allPositions = getPositionsForNote(practiceNote)
          const totalPositions = allPositions.length

          // Use a timeout to let the state update and check completion
          setTimeout(() => {
            setPlayedPositions((currentPlayed) => {
              if (currentPlayed.length >= totalPositions) {
                // All positions played! Start transition period
                setIsTransitioning(true)

                // After delay, move to next note
                setTimeout(() => {
                  const nextNote = getRandomNote()
                  setPracticeNote(nextNote)
                  playedOctavesRef.current.clear()
                  holdStartRef.current = null
                  setPlayedPositions([])
                  setIsTransitioning(false)
                }, NEXT_NOTE_DELAY_MS)
              }
              return currentPlayed
            })
          }, 100)
        }
        // Otherwise, still holding - continue waiting
      } else {
        // Started holding a new note+octave - begin tracking
        holdStartRef.current = {
          note: practiceNote,
          octave: matchedOctave,
          startTime: now,
        }
      }
    },
    [isPracticing, practiceNote, isTransitioning]
  )

  const { startListening, stopListening } = usePitchDetection({
    bufferSize: 2048,
    minVolume: -60,
    updateIntervalMs: 16,
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

  const handleStartPractice = async () => {
    if (isPracticing) {
      // Stop practicing
      await stopListening()
      setIsPracticing(false)
      setPracticeNote(null)
      setPlayedPositions([])
      playedOctavesRef.current.clear()
      holdStartRef.current = null
      setIsTransitioning(false)
    } else {
      // Start practicing
      const note = getRandomNote()
      setPracticeNote(note)
      setPlayedPositions([])
      playedOctavesRef.current.clear()
      holdStartRef.current = null
      setIsTransitioning(false)
      await startListening()
      setIsPracticing(true)
    }
  }

  const handleModeChange = async (newMode: Mode) => {
    // Stop practicing when switching modes
    if (isPracticing) {
      await stopListening()
      setIsPracticing(false)
      setPracticeNote(null)
      setPlayedPositions([])
      playedOctavesRef.current.clear()
      holdStartRef.current = null
      setIsTransitioning(false)
    }
    setMode(newMode)
  }

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

  const handleFretPress = (stringIndex: number, fret: number, note: NoteName) => {
    setLastPressedNote({ stringIndex, fret, note })
    // In manual mode, selecting a fret also selects that note
    if (mode === "manual") {
      setSelectedNote(note)
    }
  }

  // Get highlighted positions based on mode
  const highlightedPositions =
    mode === "manual"
      ? getPositionsForNote(selectedNote)
      : mode === "practice" && showNotes && practiceNote
        ? getPositionsForNote(practiceNote)
        : []

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

        {/* Note selector (manual mode) or Start button (auto mode) */}
        {mode === "manual" ? (
          <View style={styles.noteSelectContainer}>
            <Pressable style={styles.noteSelect} onPress={() => setShowNotePicker(!showNotePicker)}>
              <Text style={styles.noteSelectText}>{selectedNote}</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </Pressable>
            {showNotePicker && (
              <View style={styles.notePicker}>
                {NATURAL_NOTES.map((note) => (
                  <Pressable
                    key={note}
                    style={[
                      styles.notePickerItem,
                      selectedNote === note && styles.notePickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedNote(note)
                      setShowNotePicker(false)
                    }}
                  >
                    <Text
                      style={[
                        styles.notePickerItemText,
                        selectedNote === note && styles.notePickerItemTextActive,
                      ]}
                    >
                      {note}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.practiceControls}>
            {/* Current note display */}
            {practiceNote && (
              <View style={[styles.currentNoteDisplay, isTransitioning && styles.transitionDisplay]}>
                <Text style={styles.currentNoteLabel}>
                  {isTransitioning ? "Nice!" : "Find:"}
                </Text>
                <Text style={[styles.currentNoteText, isTransitioning && styles.transitionNoteText]}>
                  {practiceNote}
                </Text>
                <Text style={styles.progressText}>
                  {isTransitioning
                    ? "Next..."
                    : `${playedPositions.length}/${getPositionsForNote(practiceNote).length}`}
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.startButton, isPracticing && styles.stopButton]}
              onPress={handleStartPractice}
            >
              <Text style={styles.startButtonText}>{isPracticing ? "Stop" : "Start"}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.startButton,
                showNotes && styles.activeButton,
              ]}
              onPress={() => setShowNotes(!showNotes)}
            >
              <Text style={styles.startButtonText}>Show Hints</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Fretboard */}
      <View style={styles.fretboardContainer}>
        <Fretboard
          onFretPress={handleFretPress}
          highlightedPositions={highlightedPositions}
          correctPositions={mode === "practice" ? playedPositions : []}
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
  },
  notePickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  notePickerItemActive: {
    backgroundColor: theme.colors.muted,
  },
  notePickerItemText: {
    color: theme.colors.primary,
    fontSize: 16,
  },
  notePickerItemTextActive: {
    fontWeight: "600",
  },
  practiceControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  currentNoteDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  currentNoteLabel: {
    color: theme.colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
  },
  currentNoteText: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "bold",
  },
  transitionDisplay: {
    backgroundColor: "#22c55e22",
    borderColor: "#22c55e",
    borderWidth: 1,
  },
  transitionNoteText: {
    color: "#22c55e",
  },
  progressText: {
    color: theme.colors.mutedForeground,
    fontSize: 12,
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
  activeButton: {
    backgroundColor: "#007AFF",
  },
  startButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "600",
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
    color: theme.colors.background,
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
  fretboardText: {
    fontSize: 32,
    fontWeight: "bold",
    color: theme.colors.primary,
  },
})
