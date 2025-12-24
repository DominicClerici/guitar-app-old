import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import * as ScreenOrientation from "expo-screen-orientation"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native"

import { theme } from "@/utils/theme"
import { Fretboard, getPositionsForNote, type NoteName } from "../../components/fretboard"

type Mode = "manual" | "auto"
const NATURAL_NOTES: NoteName[] = ["A", "B", "C", "D", "E", "F", "G"]

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
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
    router.back()
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

  // Get all positions for the selected note in manual mode
  const highlightedPositions = mode === "manual" ? getPositionsForNote(selectedNote) : []

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
            onPress={() => setMode("manual")}
          >
            <Text style={[styles.modeButtonText, mode === "manual" && styles.modeButtonTextActive]}>
              Manual
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === "auto" && styles.modeButtonActive]}
            onPress={() => setMode("auto")}
          >
            <Text style={[styles.modeButtonText, mode === "auto" && styles.modeButtonTextActive]}>
              Auto
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
          <Pressable style={styles.startButton}>
            <Text style={styles.startButtonText}>Start</Text>
          </Pressable>
        )}
      </View>

      {/* Fretboard */}
      <View style={styles.fretboardContainer}>
        <Fretboard onFretPress={handleFretPress} highlightedPositions={highlightedPositions} />
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
  startButton: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
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
