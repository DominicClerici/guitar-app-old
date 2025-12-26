import { Ionicons } from "@expo/vector-icons"
import { requestRecordingPermissionsAsync } from "expo-audio"
import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { Animated, Pressable, StyleSheet, Text, View } from "react-native"

import PitchDetection from "@techoptio/react-native-live-pitch-detection"

import { theme } from "@/utils/theme"

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const A4_FREQUENCY = 440

type TuningStatus = "flat" | "sharp" | "in-tune" | "idle"

interface NoteInfo {
  note: string
  octave: number
  frequency: number
  targetFrequency: number
  cents: number
}

function parseNoteFromLibrary(noteString: string): { noteName: string; octave: number } | null {
  if (!noteString || noteString === "-") return null

  // Library returns notes like "C4", "A#3", "Db5"
  const match = noteString.match(/^([A-G][#b]?)(\d+)$/)
  if (!match) return null

  let noteName = match[1]
  const octave = parseInt(match[2], 10)

  // Convert flats to sharps for consistency
  if (noteName.includes("b")) {
    const flatToSharp: Record<string, string> = {
      Db: "C#",
      Eb: "D#",
      Gb: "F#",
      Ab: "G#",
      Bb: "A#",
    }
    noteName = flatToSharp[noteName] || noteName
  }

  return { noteName, octave }
}

function getNoteFrequency(noteName: string, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(noteName as (typeof NOTE_NAMES)[number])
  if (noteIndex === -1) return 0

  // A4 is at index 9, octave 4
  // Calculate semitones from A4
  const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9)
  return A4_FREQUENCY * Math.pow(2, semitonesFromA4 / 12)
}

function calculateCents(detectedFreq: number, targetFreq: number): number {
  if (targetFreq <= 0 || detectedFreq <= 0) return 0
  return 1200 * Math.log2(detectedFreq / targetFreq)
}

function getTuningStatus(cents: number): TuningStatus {
  if (Math.abs(cents) <= 5) return "in-tune"
  return cents < 0 ? "flat" : "sharp"
}

function getTuningStatusColor(status: TuningStatus): string {
  switch (status) {
    case "in-tune":
      return "#22c55e" // green
    case "flat":
      return "#f97316" // orange
    case "sharp":
      return "#f97316" // orange
    default:
      return theme.colors.mutedForeground
  }
}

export default function Tuner() {
  const router = useRouter()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [noteInfo, setNoteInfo] = useState<NoteInfo | null>(null)
  const [tuningStatus, setTuningStatus] = useState<TuningStatus>("idle")

  const needleRotation = useRef(new Animated.Value(0)).current
  const glowOpacity = useRef(new Animated.Value(0)).current
  const subscriptionRef = useRef<{ remove: () => void } | null>(null)

  const animateNeedle = useCallback(
    (cents: number) => {
      // Clamp cents to ±50 range and map to rotation (-45 to +45 degrees)
      const clampedCents = Math.max(-50, Math.min(50, cents))
      const rotation = (clampedCents / 50) * 45

      Animated.spring(needleRotation, {
        toValue: rotation,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start()
    },
    [needleRotation],
  )

  const animateGlow = useCallback(
    (isInTune: boolean) => {
      Animated.timing(glowOpacity, {
        toValue: isInTune ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    },
    [glowOpacity],
  )

  useFocusEffect(
    useCallback(() => {
      let isMounted = true

      const setup = async () => {
        try {
          const { granted } = await requestRecordingPermissionsAsync()

          if (!isMounted) return

          setHasPermission(granted)
          if (!granted) return

          try {
            await PitchDetection.stopListening()
          } catch {
            // Ignore - may not have been listening
          }
          await new Promise((resolve) => setTimeout(resolve, 200))
          if (!isMounted) return
          PitchDetection.setOptions({
            bufferSize: 4096 * 0.5,
            minVolume: -70,
            updateIntervalMs: 8,
            a4Frequency: A4_FREQUENCY,
          })

          await new Promise((resolve) => setTimeout(resolve, 200))
          if (!isMounted) return
          await PitchDetection.startListening()
          if (!isMounted) {
            PitchDetection.stopListening().catch(() => {})
            return
          }

          subscriptionRef.current = PitchDetection.addListener((event) => {
            if (!isMounted) return

            const parsed = parseNoteFromLibrary(event.note)

            if (parsed && event.frequency > 0) {
              const targetFreq = getNoteFrequency(parsed.noteName, parsed.octave)
              const cents = calculateCents(event.frequency, targetFreq)
              const status = getTuningStatus(cents)

              setNoteInfo({
                note: parsed.noteName,
                octave: parsed.octave,
                frequency: event.frequency,
                targetFrequency: targetFreq,
                cents,
              })
              setTuningStatus(status)
              animateNeedle(cents)
              animateGlow(status === "in-tune")
            } else {
              setNoteInfo(null)
              setTuningStatus("idle")
              animateNeedle(0)
              animateGlow(false)
            }
          })
        } catch (error) {
          console.error("[Tuner] Setup failed:", error)
        }
      }

      setup()

      return () => {
        isMounted = false
        if (subscriptionRef.current) {
          subscriptionRef.current.remove()
          subscriptionRef.current = null
        }
        PitchDetection.stopListening().catch((e) => {})
      }
    }, [animateGlow, animateNeedle]),
  )

  const handleBack = () => {
    router.back()
  }

  // Permission denied view
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Tuner</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <Ionicons name="mic-off" size={64} color={theme.colors.mutedForeground} />
          <Text style={styles.permissionTitle}>Microphone Access Required</Text>
          <Text style={styles.permissionText}>
            Please enable microphone access in your device settings to use the tuner.
          </Text>
        </View>
      </View>
    )
  }

  // Loading permission state
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Tuner</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <Text style={styles.loadingText}>Requesting microphone access...</Text>
        </View>
      </View>
    )
  }

  const needleRotationStyle = {
    transform: [
      {
        rotate: needleRotation.interpolate({
          inputRange: [-45, 45],
          outputRange: ["-45deg", "45deg"],
        }),
      },
    ],
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Tuner</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main tuner display */}
      <View style={styles.tunerContainer}>
        {/* Note display */}
        <View style={styles.noteDisplay}>
          <Text style={[styles.noteName, { color: getTuningStatusColor(tuningStatus) }]}>
            {noteInfo ? `${noteInfo.note}${noteInfo.octave}` : "--"}
          </Text>
          <Text style={styles.frequency}>
            {noteInfo ? `${noteInfo.frequency.toFixed(1)} Hz` : "-- Hz"}
          </Text>
        </View>

        {/* Visual tuner gauge */}
        <View style={styles.gaugeContainer}>
          {/* Gauge background arc */}
          <View style={styles.gaugeArc}>
            {/* Scale markers */}
            <View style={[styles.scaleMarker, styles.scaleMarkerLeft2]}>
              <Text style={styles.scaleText}>-50</Text>
            </View>
            <View style={[styles.scaleMarker, styles.scaleMarkerLeft1]}>
              <Text style={styles.scaleText}>-25</Text>
            </View>
            <View style={[styles.scaleMarker, styles.scaleMarkerCenter]}>
              <View style={styles.centerMarker} />
            </View>
            <View style={[styles.scaleMarker, styles.scaleMarkerRight1]}>
              <Text style={styles.scaleText}>+25</Text>
            </View>
            <View style={[styles.scaleMarker, styles.scaleMarkerRight2]}>
              <Text style={styles.scaleText}>+50</Text>
            </View>

            {/* Flat/Sharp labels */}
            <Text style={[styles.flatSharpLabel, styles.flatLabel]}>♭ FLAT</Text>
            <Text style={[styles.flatSharpLabel, styles.sharpLabel]}>SHARP ♯</Text>
          </View>

          {/* In-tune glow effect */}
          <Animated.View style={[styles.inTuneGlow, { opacity: glowOpacity }]} />

          {/* Needle */}
          <View style={styles.needleContainer}>
            <Animated.View style={[styles.needle, needleRotationStyle]} />
            <View style={styles.needlePivot} />
          </View>
        </View>

        {/* Cents display */}
        <View style={styles.centsDisplay}>
          <Text style={[styles.centsValue, { color: getTuningStatusColor(tuningStatus) }]}>
            {noteInfo ? `${noteInfo.cents >= 0 ? "+" : ""}${noteInfo.cents.toFixed(0)}` : "--"}
          </Text>
          <Text style={styles.centsLabel}>cents</Text>
        </View>

        {/* Status text */}
        <Text style={[styles.statusText, { color: getTuningStatusColor(tuningStatus) }]}>
          {tuningStatus === "in-tune" && "IN TUNE"}
          {tuningStatus === "flat" && "TOO FLAT"}
          {tuningStatus === "sharp" && "TOO SHARP"}
          {tuningStatus === "idle" && "Play a note..."}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  headerSpacer: {
    width: 40,
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.primary,
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
  },
  tunerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noteDisplay: {
    alignItems: "center",
    marginBottom: 40,
  },
  noteName: {
    fontSize: 72,
    fontWeight: "bold",
  },
  frequency: {
    fontSize: 18,
    color: theme.colors.mutedForeground,
    marginTop: 8,
  },
  gaugeContainer: {
    width: 280,
    height: 160,
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  gaugeArc: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: theme.colors.border,
  },
  scaleMarker: {
    position: "absolute",
    bottom: 0,
  },
  scaleMarkerLeft2: {
    left: 10,
    bottom: 20,
  },
  scaleMarkerLeft1: {
    left: 50,
    bottom: 70,
  },
  scaleMarkerCenter: {
    left: "50%",
    marginLeft: -1,
    bottom: 95,
  },
  scaleMarkerRight1: {
    right: 50,
    bottom: 70,
  },
  scaleMarkerRight2: {
    right: 10,
    bottom: 20,
  },
  scaleText: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  centerMarker: {
    width: 2,
    height: 20,
    backgroundColor: "#22c55e",
  },
  flatSharpLabel: {
    position: "absolute",
    bottom: -5,
    fontSize: 12,
    color: theme.colors.mutedForeground,
    fontWeight: "600",
  },
  flatLabel: {
    left: 20,
  },
  sharpLabel: {
    right: 20,
  },
  inTuneGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: "#22c55e",
  },
  needleContainer: {
    position: "absolute",
    bottom: 0,
    width: 280,
    height: 140,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  needle: {
    width: 3,
    height: 120,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    position: "absolute",
    bottom: 10,
    transformOrigin: "bottom",
  },
  needlePivot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    position: "absolute",
    bottom: 2,
  },
  centsDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 32,
  },
  centsValue: {
    fontSize: 36,
    fontWeight: "bold",
  },
  centsLabel: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    letterSpacing: 1,
  },
})
