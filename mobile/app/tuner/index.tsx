import { ScreenContainer } from "@/components/ScreenContainer"
import { useFastPitchDetection } from "@/lib/audio/useFastPitchDetection"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, useWindowDimensions, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

// Note names using sharps (prefer sharps over flats)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

// A4 = 440 Hz is the reference pitch (MIDI note 69)
const A4_FREQ = 440
const A4_MIDI = 69

// Frequency range: E1 (~41.2 Hz) to E6 (~1318.5 Hz)
// E1 is MIDI note 28, E6 is MIDI note 88
const MIN_MIDI = 28 // E1
const MAX_MIDI = 88 // E6

// Seismograph configuration
const CHART_HEIGHT_PERCENT = 65
const CHART_WIDTH_PERCENT = 90
const MAX_POINTS = 100 // Number of data points to display
const UPDATE_INTERVAL_MS = 46.5 // How often to add new points when playing (faster scroll)
const CENTS_RANGE = 50 // +/- 50 cents displayed

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

// Get the closest note name to a given frequency
function getClosestNoteName(freq: number): string | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))
  return midiToNoteName(clampedMidi)
}

// Get cents deviation from the closest note
function getCentsDeviation(freq: number): number | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))
  const targetFreq = midiToFreq(clampedMidi)
  return 1200 * Math.log2(freq / targetFreq)
}

interface DataPoint {
  cents: number // -50 to +50 (clamped)
  isActive: boolean // Whether pitch was detected at this point
}

// Circular buffer for efficient data point management
class CircularBuffer {
  private buffer: DataPoint[]
  private _head: number = 0 // Points to the oldest element (next to be overwritten)
  private _version: number = 0 // Incremented on each push to trigger re-renders
  readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.buffer = Array(capacity)
      .fill(null)
      .map(() => ({ cents: 0, isActive: false }))
  }

  get head(): number {
    return this._head
  }

  get version(): number {
    return this._version
  }

  push(point: DataPoint): void {
    this.buffer[this._head] = point
    this._head = (this._head + 1) % this.capacity
    this._version++
  }

  // Get point at logical index (0 = oldest, capacity-1 = newest)
  getAt(logicalIndex: number): DataPoint {
    const physicalIndex = (this._head + logicalIndex) % this.capacity
    return this.buffer[physicalIndex]
  }

  // Find the last active point's cents value
  getLastActiveCents(): number {
    for (let i = 0; i < this.capacity; i++) {
      const index = (this._head - 1 - i + this.capacity * 2) % this.capacity
      if (this.buffer[index].isActive) {
        return this.buffer[index].cents
      }
    }
    return 0
  }
}

// Get color based on cents deviation
function getColorForCents(cents: number): string {
  const absCents = Math.abs(cents)
  if (absCents > 15) return "#f87171" // Red (way off)
  if (absCents > 5) return "#fbbf24" // Yellow (slightly off)
  return "#4ade80" // Green (in tune)
}

// Pre-computed indicator styles to avoid array creation on every render
type IndicatorState = "inTune" | "sharp" | "flat"
function getIndicatorState(cents: number): IndicatorState {
  if (Math.abs(cents) <= 5) return "inTune"
  if (cents > 5) return "sharp"
  return "flat"
}

// Pre-computed cents text styles
type CentsState = "inTune" | "sharp" | "flat"
function getCentsState(cents: number): CentsState {
  if (Math.abs(cents) <= 5) return "inTune"
  if (cents > 5) return "sharp"
  return "flat"
}

// Convert cents to X position (0 to chartWidth)
function centsToX(cents: number, chartWidth: number): number {
  const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, cents))
  return ((clamped + CENTS_RANGE) / (CENTS_RANGE * 2)) * chartWidth
}

function SeismographChart({
  buffer,
  bufferVersion,
  currentCents,
  chartWidth,
  chartHeight,
}: {
  buffer: CircularBuffer
  bufferVersion: number
  currentCents: number | null
  chartWidth: number
  chartHeight: number
}) {
  // Animated value for the current indicator position
  const indicatorX = useSharedValue(50) // percentage (50 = center)

  useEffect(() => {
    if (currentCents !== null) {
      // Map cents (-50 to +50) to percentage (0 to 100)
      const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, currentCents))
      const percent = ((clamped + CENTS_RANGE) / (CENTS_RANGE * 2)) * 100
      indicatorX.value = percent
    }
  }, [currentCents, indicatorX])

  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${indicatorX.value}%`,
  }))

  // Generate SVG path data - memoized for performance
  // Groups consecutive active points into path segments by color
  // Uses bufferVersion as dependency to trigger recalculation without array allocation
  const pathSegments = useMemo(() => {
    const segments: Array<{ d: string; color: string }> = []
    const segmentHeight = chartHeight / MAX_POINTS

    let currentPath = ""
    let currentColor = ""
    let lastX = 0
    let lastY = 0

    for (let i = 1; i < buffer.capacity; i++) {
      const point = buffer.getAt(i)
      const prevPoint = buffer.getAt(i - 1)

      // Only draw if both points are active
      if (!point.isActive || !prevPoint.isActive) {
        // End current path segment if we have one
        if (currentPath) {
          segments.push({ d: currentPath, color: currentColor })
          currentPath = ""
          currentColor = ""
        }
        continue
      }

      const x1 = centsToX(prevPoint.cents, chartWidth)
      const y1 = (MAX_POINTS - i + 1) * segmentHeight
      const x2 = centsToX(point.cents, chartWidth)
      const y2 = (MAX_POINTS - i) * segmentHeight

      // Use the average cents for color
      const avgCents = (point.cents + prevPoint.cents) / 2
      const color = getColorForCents(avgCents)

      // If color changes or this is a new segment, start a new path
      if (color !== currentColor) {
        if (currentPath) {
          segments.push({ d: currentPath, color: currentColor })
        }
        currentPath = `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`
        currentColor = color
      } else {
        // Continue the path - if we're at the same position, just lineto
        if (Math.abs(lastX - x1) < 0.1 && Math.abs(lastY - y1) < 0.1) {
          currentPath += `L${x2.toFixed(1)},${y2.toFixed(1)}`
        } else {
          // Need to move to new position
          currentPath += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`
        }
      }
      lastX = x2
      lastY = y2
    }

    // Don't forget the last segment
    if (currentPath) {
      segments.push({ d: currentPath, color: currentColor })
    }

    return segments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferVersion, chartWidth, chartHeight])

  return (
    <View style={styles.chartContainer}>
      {/* Chart labels */}
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>♭ Flat</Text>
        <Text style={[styles.chartLabel, styles.chartLabelCenter]}>In Tune</Text>
        <Text style={styles.chartLabel}>Sharp ♯</Text>
      </View>

      {/* Main chart area */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {/* Center line (in-tune reference) */}
        <View style={styles.centerLine} />

        {/* Guide lines at -25 and +25 cents */}
        <View style={[styles.guideLine, { left: "25%" }]} />
        <View style={[styles.guideLine, { left: "75%" }]} />

        {/* SVG Seismograph line - using Path elements for better performance */}
        <Svg width={chartWidth} height={chartHeight} style={styles.svgContainer}>
          {pathSegments.map((seg, idx) => (
            <Path
              key={idx}
              d={seg.d}
              stroke={seg.color}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </Svg>

        {/* Current position indicator at the top */}
        {currentCents !== null && (
          <Animated.View style={[styles.currentIndicator, indicatorStyle]}>
            <View style={indicatorDotStyles[getIndicatorState(currentCents)]} />
          </Animated.View>
        )}
      </View>
    </View>
  )
}

export default function TunerScreen() {
  // const { status, error, pitch } = usePitchDetection()
  const { status, error, pitch } = useFastPitchDetection()

  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  // Use primitive values instead of noteInfo object to stabilize dependencies
  const noteName = getClosestNoteName(pitch)
  const cents = getCentsDeviation(pitch)

  // Circular buffer for efficient data point management (avoids array spreading)
  const bufferRef = useRef<CircularBuffer>(new CircularBuffer(MAX_POINTS))
  const [bufferVersion, setBufferVersion] = useState(0)
  const lastUpdateRef = useRef<number>(0)
  const centsRef = useRef<number | null>(null)

  // Keep centsRef in sync with current cents value
  centsRef.current = cents

  // Calculate chart dimensions based on screen size
  // Container has paddingHorizontal: 20, chart is 90% of container width
  const chartWidth = (windowWidth - 40) * (CHART_WIDTH_PERCENT / 100)
  const chartHeight = windowHeight * (CHART_HEIGHT_PERCENT / 100)

  // Update data points when pitch changes - reads from ref for stable callback
  const updateDataPoints = useCallback(() => {
    const now = Date.now()
    if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) {
      return
    }
    lastUpdateRef.current = now

    const buffer = bufferRef.current
    const currentCents = centsRef.current
    if (currentCents !== null) {
      buffer.push({ cents: currentCents, isActive: true })
    } else {
      // Keep the last cents value but mark as inactive (stops drawing)
      buffer.push({ cents: buffer.getLastActiveCents(), isActive: false })
    }
    // Trigger re-render with the buffer's version (no array allocation)
    setBufferVersion(buffer.version)
  }, [])

  // Effect to continuously update the chart - interval persists while recording
  useEffect(() => {
    if (status !== "recording") return

    // Set up interval for continuous updates (reads current cents from ref)
    const interval = setInterval(updateDataPoints, UPDATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, updateDataPoints])

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {error && <Text style={styles.error}>{error}</Text>}

        {status === "recording" && (
          <>
            {/* Pitch display above chart */}
            <View style={styles.pitchContainer}>
              <Text style={styles.noteText}>{noteName ?? "--"}</Text>
              <View style={styles.pitchDetails}>
                <Text style={styles.frequencyText}>
                  {pitch > 0 ? `${pitch.toFixed(1)} Hz` : "-- Hz"}
                </Text>
                {cents !== null && (
                  <Text style={centsTextStyles[getCentsState(cents)]}>
                    {cents > 0 ? "+" : ""}
                    {cents.toFixed(0)} cents
                  </Text>
                )}
              </View>
            </View>

            {/* Seismograph chart */}
            <SeismographChart
              buffer={bufferRef.current}
              bufferVersion={bufferVersion}
              currentCents={cents}
              chartWidth={chartWidth}
              chartHeight={chartHeight}
            />
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
    justifyContent: "flex-start",
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  error: {
    color: "#f87171",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  pitchContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  noteText: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#fff",
  },
  pitchDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  frequencyText: {
    fontSize: 20,
    color: "#888",
    fontVariant: ["tabular-nums"],
  },
  // Chart styles
  chartContainer: {
    width: `${CHART_WIDTH_PERCENT}%`,
    alignItems: "center",
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: "#666",
  },
  chartLabelCenter: {
    color: "#4ade80",
  },
  chartArea: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  centerLine: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#4ade8040",
  },
  guideLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#ffffff10",
  },
  svgContainer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  currentIndicator: {
    position: "absolute",
    top: 0,
    marginLeft: -8,
    zIndex: 10,
  },
})

// Pre-computed combined styles to avoid array spreading on every render
const indicatorDotStyles: Record<IndicatorState, object> = {
  inTune: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4ade80",
    borderWidth: 2,
    borderColor: "#4ade80",
  },
  sharp: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fbbf24",
    borderWidth: 2,
    borderColor: "#fbbf24",
  },
  flat: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f87171",
    borderWidth: 2,
    borderColor: "#f87171",
  },
}

const centsTextStyles: Record<CentsState, object> = {
  inTune: {
    fontSize: 20,
    fontVariant: ["tabular-nums"] as const,
    color: "#4ade80",
  },
  sharp: {
    fontSize: 20,
    fontVariant: ["tabular-nums"] as const,
    color: "#fbbf24",
  },
  flat: {
    fontSize: 20,
    fontVariant: ["tabular-nums"] as const,
    color: "#f87171",
  },
}
