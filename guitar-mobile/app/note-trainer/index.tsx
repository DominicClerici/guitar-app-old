import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native"

import { useLandscapeOrientation } from "@/hooks/useLandscapeOrientation"
import { usePitchDetection, type DetectedNote } from "@/hooks/usePitchDetection"
import { frequencyMatchesNote, HOLD_DURATION_MS } from "@/utils/pitchUtils"
import { fretboardScreenStyles as shared } from "@/utils/sharedStyles"
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

// Delay after completing all positions before next note (ms)
const NEXT_NOTE_DELAY_MS = 2000

function getRandomNote(): NoteName {
  const index = Math.floor(Math.random() * NOTES.length)
  return NOTES[index]
}

export default function NoteTrainer() {
  const router = useRouter()
  const { showRotatePrompt, rotateToLandscape, rotateToPortrait } = useLandscapeOrientation()
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
  const [playedPositions, setPlayedPositions] = useState<
    Array<{ stringIndex: number; fret: number }>
  >([])

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
                (p) => p.stringIndex === pos.stringIndex && p.fret === pos.fret,
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
    [isPracticing, practiceNote, isTransitioning],
  )

  const { startListening, stopListening } = usePitchDetection({
    bufferSize: 4096,
    minVolume: -70,
    updateIntervalMs: 25,
    onNoteDetected: handleNoteDetected,
  })

  const handleBack = async () => {
    if (isPracticing) {
      await stopListening()
      setIsPracticing(false)
    }
    await rotateToPortrait()
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

  const handleFretPress = (stringIndex: number, fret: number, note: NoteName) => {
    setLastPressedNote({ stringIndex, fret, note })
    // In manual mode, selecting a fret also selects that note
    if (mode === "manual") {
      setSelectedNote(note)
    }
  }

  // Get highlighted positions based on mode
  const highlightedPositions = mode === "manual" ? getPositionsForNote(selectedNote) : []

  // In practice mode with hints, show unplayed positions as grayed-out hints
  const hintPositions =
    mode === "practice" && showNotes && practiceNote
      ? getPositionsForNote(practiceNote).filter(
          (pos) =>
            !playedPositions.some((p) => p.stringIndex === pos.stringIndex && p.fret === pos.fret),
        )
      : []

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

        {/* Note selector (manual mode) or Start button (auto mode) */}
        {mode === "manual" ? (
          <View style={shared.noteSelectContainer}>
            <Pressable style={shared.noteSelect} onPress={() => setShowNotePicker(!showNotePicker)}>
              <Text style={shared.noteSelectText}>{selectedNote}</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </Pressable>
            {showNotePicker && (
              <View style={shared.notePicker}>
                {NATURAL_NOTES.map((note) => (
                  <Pressable
                    key={note}
                    style={[
                      shared.notePickerItem,
                      selectedNote === note && shared.notePickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedNote(note)
                      setShowNotePicker(false)
                    }}
                  >
                    <Text
                      style={[
                        shared.notePickerItemText,
                        selectedNote === note && shared.notePickerItemTextActive,
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
          <View style={shared.practiceControls}>
            {/* Current note display */}
            {practiceNote && (
              <View
                style={[styles.currentNoteDisplay, isTransitioning && shared.transitionDisplay]}
              >
                <Text style={styles.currentNoteLabel}>{isTransitioning ? "Nice!" : "Find:"}</Text>
                <Text
                  style={[styles.currentNoteText, isTransitioning && styles.transitionNoteText]}
                >
                  {practiceNote}
                </Text>
                <Text style={shared.progressText}>
                  {isTransitioning
                    ? "Next..."
                    : `${playedPositions.length}/${getPositionsForNote(practiceNote).length}`}
                </Text>
              </View>
            )}

            <Pressable
              style={[shared.startButton, isPracticing && shared.stopButton]}
              onPress={handleStartPractice}
            >
              <Text style={shared.startButtonText}>{isPracticing ? "Stop" : "Start"}</Text>
            </Pressable>
            <Pressable
              style={[shared.startButton, showNotes && styles.activeButton]}
              onPress={() => setShowNotes(!showNotes)}
            >
              <Text style={shared.startButtonText}>Show Hints</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Fretboard */}
      <View style={shared.fretboardContainer}>
        <Fretboard
          onFretPress={handleFretPress}
          hintPositions={hintPositions}
          rootPositions={mode === "manual" ? highlightedPositions : playedPositions}
        />
      </View>
    </View>
  )
}

// Note-trainer-specific styles (extends shared fretboard screen styles)
const styles = StyleSheet.create({
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
  transitionNoteText: {
    color: "#22c55e",
  },
  activeButton: {
    backgroundColor: "#007AFF",
  },
})
