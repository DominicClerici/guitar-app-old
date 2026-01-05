import { ScreenContainer } from "@/components/ScreenContainer"
import { usePitchDetection } from "@/lib/audio/usePitchDetection"
import { StyleSheet, Text, View } from "react-native"

// Note names using sharps (prefer sharps over flats)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

// A4 = 440 Hz is the reference pitch (MIDI note 69)
const A4_FREQ = 440
const A4_MIDI = 69

// Frequency range: E1 (~41.2 Hz) to E6 (~1318.5 Hz)
// E1 is MIDI note 28, E6 is MIDI note 88
const MIN_MIDI = 28 // E1
const MAX_MIDI = 88 // E6

// Convert frequency to MIDI note number (can be fractional)
function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI
}

// Convert MIDI note number to frequency
function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12)
}

// Get note name and octave from MIDI note number
function midiToNoteName(midi: number): string {
  const noteIndex = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

// Get the closest note to a given frequency
function getClosestNote(freq: number): { note: string; cents: number } | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)

  // Check if within range
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  // Round to nearest MIDI note
  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))

  // Calculate cents deviation
  const targetFreq = midiToFreq(clampedMidi)
  const cents = 1200 * Math.log2(freq / targetFreq)

  return { note: midiToNoteName(clampedMidi), cents }
}

export default function TunerScreen() {
  const { status, error, pitch } = usePitchDetection()

  const noteInfo = getClosestNote(pitch)

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {error && <Text style={styles.error}>{error}</Text>}

        {status === "recording" && (
          <>
            {/* Pitch display */}
            <View style={styles.pitchContainer}>
              <Text style={styles.noteText}>{noteInfo?.note ?? "--"}</Text>
              <Text style={styles.frequencyText}>
                {pitch > 0 ? `${pitch.toFixed(1)} Hz` : "-- Hz"}
              </Text>
              {noteInfo && (
                <Text
                  style={[
                    styles.centsText,
                    noteInfo.cents > 5 && styles.centsSharp,
                    noteInfo.cents < -5 && styles.centsFlat,
                    Math.abs(noteInfo.cents) <= 5 && styles.centsInTune,
                  ]}
                >
                  {noteInfo.cents > 0 ? "+" : ""}
                  {noteInfo.cents.toFixed(0)} cents
                </Text>
              )}
            </View>

            {/* Tuning indicator bar */}
            <View style={styles.tuningBarContainer}>
              <View style={styles.tuningBarBackground}>
                <View style={styles.tuningBarCenter} />
                {noteInfo && (
                  <View
                    style={[
                      styles.tuningBarIndicator,
                      {
                        left: `${50 + Math.max(-50, Math.min(50, noteInfo.cents))}%`,
                      },
                      Math.abs(noteInfo.cents) <= 5 && styles.tuningBarInTune,
                    ]}
                  />
                )}
              </View>
              <View style={styles.tuningLabels}>
                <Text style={styles.tuningLabel}>♭ Flat</Text>
                <Text style={styles.tuningLabel}>In Tune</Text>
                <Text style={styles.tuningLabel}>Sharp ♯</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  error: {
    color: "#f87171",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  pitchContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  noteText: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#fff",
  },
  frequencyText: {
    fontSize: 24,
    color: "#888",
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  centsText: {
    fontSize: 20,
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  centsInTune: {
    color: "#4ade80",
  },
  centsSharp: {
    color: "#fbbf24",
  },
  centsFlat: {
    color: "#f87171",
  },
  tuningBarContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 30,
  },
  tuningBarBackground: {
    width: "90%",
    height: 30,
    backgroundColor: "#333",
    borderRadius: 15,
    position: "relative",
    overflow: "hidden",
  },
  tuningBarCenter: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 4,
    marginLeft: -2,
    backgroundColor: "#4ade80",
  },
  tuningBarIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: 8,
    marginLeft: -4,
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  tuningBarInTune: {
    backgroundColor: "#4ade80",
  },
  tuningLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    marginTop: 8,
  },
  tuningLabel: {
    fontSize: 12,
    color: "#666",
  },
})
