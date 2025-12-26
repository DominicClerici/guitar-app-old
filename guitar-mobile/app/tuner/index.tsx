import { Ionicons } from "@expo/vector-icons"
import { requestRecordingPermissionsAsync } from "expo-audio"
import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native"
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg"

import PitchDetection from "@techoptio/react-native-live-pitch-detection"

import { theme } from "@/utils/theme"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const A4_FREQUENCY = 440

// Seismograph settings
const GRAPH_WIDTH = SCREEN_WIDTH - 48 // Account for padding
const GRAPH_HEIGHT = SCREEN_HEIGHT * 0.45
const CENTER_X = GRAPH_WIDTH / 2
const MAX_DEFLECTION = GRAPH_WIDTH * 0.4 // Max horizontal deflection from center
const POINTS_PER_SECOND = 60 // How many data points per second
const SCROLL_SPEED = 80 // Pixels per second the line scrolls down
const MAX_POINTS = Math.ceil((GRAPH_HEIGHT / SCROLL_SPEED) * POINTS_PER_SECOND) + 10

type TuningStatus = "flat" | "sharp" | "in-tune" | "idle"

interface NoteInfo {
  note: string
  octave: number
  frequency: number
  targetFrequency: number
  cents: number
}

interface DataPoint {
  cents: number // -50 to +50, or null for no signal
  timestamp: number
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

function centsToXPosition(cents: number): number {
  // Map cents (-50 to +50) to X position
  // Flat (negative) = left of center, Sharp (positive) = right of center
  const clampedCents = Math.max(-50, Math.min(50, cents))
  return CENTER_X + (clampedCents / 50) * MAX_DEFLECTION
}

export default function Tuner() {
  const router = useRouter()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [noteInfo, setNoteInfo] = useState<NoteInfo | null>(null)
  const [tuningStatus, setTuningStatus] = useState<TuningStatus>("idle")
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])

  const subscriptionRef = useRef<{ remove: () => void } | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(Date.now())
  const currentCentsRef = useRef<number | null>(null)

  // Build the SVG path from data points
  const buildPath = useCallback(() => {
    if (dataPoints.length === 0) return ""

    const now = Date.now()
    let pathD = ""

    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i]
      const age = (now - point.timestamp) / 1000 // Age in seconds
      const y = age * SCROLL_SPEED // Y position based on age

      if (y > GRAPH_HEIGHT) continue // Skip points that have scrolled off

      const x = centsToXPosition(point.cents)

      if (pathD === "") {
        pathD = `M ${x} ${y}`
      } else {
        pathD += ` L ${x} ${y}`
      }
    }

    return pathD
  }, [dataPoints])

  // Animation loop to update the graph
  const startAnimation = useCallback(() => {
    const animate = () => {
      const now = Date.now()
      const elapsed = now - lastUpdateRef.current

      // Add new point at the configured rate
      if (elapsed >= 1000 / POINTS_PER_SECOND) {
        lastUpdateRef.current = now

        setDataPoints((prev) => {
          // Remove points that have scrolled off the bottom
          const filtered = prev.filter((p) => {
            const age = (now - p.timestamp) / 1000
            return age * SCROLL_SPEED <= GRAPH_HEIGHT
          })

          // Add new point
          const cents = currentCentsRef.current ?? 0
          const newPoint: DataPoint = { cents, timestamp: now }

          // Keep array size manageable
          const updated = [newPoint, ...filtered]
          if (updated.length > MAX_POINTS) {
            return updated.slice(0, MAX_POINTS)
          }
          return updated
        })
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [])

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

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
            minVolume: -60,
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

          // Start the animation loop
          startAnimation()

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
              currentCentsRef.current = cents
            } else {
              setNoteInfo(null)
              setTuningStatus("idle")
              currentCentsRef.current = 0
            }
          })
        } catch (error) {
          console.error("[Tuner] Setup failed:", error)
        }
      }

      setup()

      return () => {
        isMounted = false
        stopAnimation()
        if (subscriptionRef.current) {
          subscriptionRef.current.remove()
          subscriptionRef.current = null
        }
        PitchDetection.stopListening().catch(() => {})
      }
    }, [startAnimation, stopAnimation]),
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

  const pathD = buildPath()
  const lineColor = getTuningStatusColor(tuningStatus)

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

      {/* Note display */}
      <View style={styles.noteDisplay}>
        <Text style={[styles.noteName, { color: getTuningStatusColor(tuningStatus) }]}>
          {noteInfo ? `${noteInfo.note}${noteInfo.octave}` : "--"}
        </Text>
        <Text style={styles.frequency}>
          {noteInfo ? `${noteInfo.frequency.toFixed(1)} Hz` : "-- Hz"}
        </Text>
      </View>

      {/* Seismograph visualization */}
      <View style={styles.graphContainer}>
        <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
          <Defs>
            <LinearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="1" />
              <Stop offset="0.7" stopColor={lineColor} stopOpacity="0.5" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0.1" />
            </LinearGradient>
          </Defs>

          {/* Background grid lines */}
          <Line
            x1={CENTER_X}
            y1={0}
            x2={CENTER_X}
            y2={GRAPH_HEIGHT}
            stroke="#22c55e"
            strokeWidth={2}
            opacity={0.5}
          />
          {/* Left guide (flat zone) */}
          <Line
            x1={CENTER_X - MAX_DEFLECTION * 0.1}
            y1={0}
            x2={CENTER_X - MAX_DEFLECTION * 0.1}
            y2={GRAPH_HEIGHT}
            stroke={theme.colors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.3}
          />
          {/* Right guide (sharp zone) */}
          <Line
            x1={CENTER_X + MAX_DEFLECTION * 0.1}
            y1={0}
            x2={CENTER_X + MAX_DEFLECTION * 0.1}
            y2={GRAPH_HEIGHT}
            stroke={theme.colors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.3}
          />

          {/* In-tune zone highlight */}
          <Rect
            x={CENTER_X - MAX_DEFLECTION * 0.1}
            y={0}
            width={MAX_DEFLECTION * 0.2}
            height={GRAPH_HEIGHT}
            fill="#22c55e"
            opacity={0.08}
          />

          {/* The seismograph line */}
          {pathD && (
            <Path
              d={pathD}
              stroke="url(#fadeGradient)"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>

        {/* Scale labels */}
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLabel}>♭ FLAT</Text>
          <Text style={[styles.scaleLabel, styles.scaleLabelCenter]}>IN TUNE</Text>
          <Text style={styles.scaleLabel}>SHARP ♯</Text>
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
    marginBottom: 16,
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
  noteDisplay: {
    alignItems: "center",
    marginBottom: 16,
  },
  noteName: {
    fontSize: 56,
    fontWeight: "bold",
  },
  frequency: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  graphContainer: {
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  scaleLabel: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    fontWeight: "600",
  },
  scaleLabelCenter: {
    color: "#22c55e",
  },
  centsDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginTop: 24,
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
    marginTop: 12,
    letterSpacing: 1,
    textAlign: "center",
  },
})
