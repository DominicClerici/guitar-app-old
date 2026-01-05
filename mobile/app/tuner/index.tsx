import { ScreenContainer } from "@/components/ScreenContainer"
import { usePitchDetection } from "@/lib/audio/usePitchDetection"
import { Text, View, StyleSheet } from "react-native"

// Standard guitar tuning frequencies
const NOTES = [
  { name: "E2", freq: 82.41 },
  { name: "A2", freq: 110.0 },
  { name: "D3", freq: 146.83 },
  { name: "G3", freq: 196.0 },
  { name: "B3", freq: 246.94 },
  { name: "E4", freq: 329.63 },
]

// Get the closest note to a given frequency
function getClosestNote(freq: number): { note: string; cents: number } | null {
  if (freq <= 0) return null

  let closestNote = NOTES[0]
  let minDiff = Math.abs(freq - closestNote.freq)

  for (const note of NOTES) {
    const diff = Math.abs(freq - note.freq)
    if (diff < minDiff) {
      minDiff = diff
      closestNote = note
    }
  }

  // Calculate cents deviation: 1200 * log2(freq / targetFreq)
  const cents = 1200 * Math.log2(freq / closestNote.freq)

  return { note: closestNote.name, cents }
}

export default function TunerScreen() {
  const { status, error, pitch, rmsLevel } = usePitchDetection()

  const noteInfo = getClosestNote(pitch)
  const normalizedRms = Math.min(1, rmsLevel * 10) // Scale RMS for visualization

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Guitar Tuner</Text>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusValue,
              status === "recording" && styles.statusRecording,
              status === "error" && styles.statusError,
            ]}
          >
            {status}
          </Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {status === "recording" && (
          <>
            {/* Pitch display */}
            <View style={styles.pitchContainer}>
              <Text style={styles.noteText}>
                {noteInfo?.note ?? "--"}
              </Text>
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

            {/* Audio level meter */}
            <View style={styles.meterContainer}>
              <Text style={styles.meterLabel}>Audio Level</Text>
              <View style={styles.meterBackground}>
                <View
                  style={[
                    styles.meterFill,
                    { width: `${normalizedRms * 100}%` },
                  ]}
                />
              </View>
            </View>
          </>
        )}

        <Text style={styles.hint}>
          {status === "recording"
            ? pitch > 0
              ? "Adjust tuning until the indicator is centered"
              : "Play a note on your guitar..."
            : status === "requesting"
              ? "Requesting microphone access..."
              : status === "error"
                ? "Please grant microphone permission in settings"
                : "Initializing..."}
        </Text>
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
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 40,
    color: "#fff",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 16,
    color: "#888",
    marginRight: 8,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
    textTransform: "capitalize",
  },
  statusRecording: {
    color: "#4ade80",
  },
  statusError: {
    color: "#f87171",
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
  meterContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 30,
  },
  meterLabel: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
  },
  meterBackground: {
    width: "80%",
    height: 12,
    backgroundColor: "#333",
    borderRadius: 6,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    backgroundColor: "#4ade80",
    borderRadius: 6,
  },
  hint: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
})
