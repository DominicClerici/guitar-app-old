"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PitchResult, useAutocorrelation } from "@/hooks/useAutocorrelation"
import { getCentsDeviation, getClosestNoteName } from "@/lib/audio/utils"
import { trpc } from "@/lib/trpc/react"
import { AlertCircle, Mic } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import StringIndicator from "./string-indicator"
import TunerControls, { TUNING_PRESETS } from "./tuner-controls"
import TunerNoteDisplay from "./tuner-note-display"

type GuitarTuning = [number, number, number, number, number, number]

const TUNING_TO_HALF_STEPS: Record<string, GuitarTuning> = {
  standard: [0, 0, 0, 0, 0, 0],
  "drop-d": [-2, 0, 0, 0, 0, 0],
  "half-step-down": [-1, -1, -1, -1, -1, -1],
  "drop-c": [-4, -2, -2, -2, -2, -2],
  "open-g": [-2, -2, 0, 0, 0, -2],
  dadgad: [-2, 0, 0, 0, -2, -2],
}

function tuningArraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}

function getTuningIdFromHalfSteps(halfSteps: number[]): string {
  for (const [id, tuning] of Object.entries(TUNING_TO_HALF_STEPS)) {
    if (tuningArraysEqual(tuning, halfSteps)) {
      return id
    }
  }
  return "standard"
}

const MAX_POINTS = 100
const CENTS_RANGE = 50
const DEFAULT_SMOOTHING = 0.2
const IN_TUNE_CENTS = 8

const GRADIENT_ID = "dashboard-tuner-gradient"

function generateTunerGradientStops(): { offset: string; color: string }[] {
  const stops: { offset: number; color: string }[] = []
  const outOfTune = "var(--out-of-tune)"
  const slightOutOfTune = "var(--slight-out-of-tune)"
  const inTune = "var(--in-tune)"

  const inTunePercent = 4
  const slightOutPercent = 15

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  const interpolateColor = (from: string, to: string, t: number): string => {
    const eased = easeInOutCubic(t)
    const toPercent = Math.round(eased * 100)
    return `color-mix(in oklch, ${to} ${toPercent}%, ${from})`
  }

  stops.push({ offset: 0, color: outOfTune })

  const outOfTuneEnd = 12
  stops.push({ offset: outOfTuneEnd, color: outOfTune })

  const slightStart = 50 - slightOutPercent
  const numTransitionStops = 4
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = outOfTuneEnd + t * (slightStart - outOfTuneEnd)
    stops.push({ offset, color: interpolateColor(outOfTune, slightOutOfTune, t) })
  }
  stops.push({ offset: slightStart, color: slightOutOfTune })

  const inTuneStart = 50 - inTunePercent
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = slightStart + t * (inTuneStart - slightStart)
    stops.push({ offset, color: interpolateColor(slightOutOfTune, inTune, t) })
  }
  stops.push({ offset: inTuneStart, color: inTune })

  stops.push({ offset: 50, color: inTune })
  const inTuneEnd = 50 + inTunePercent
  stops.push({ offset: inTuneEnd, color: inTune })

  const slightEnd = 50 + slightOutPercent
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = inTuneEnd + t * (slightEnd - inTuneEnd)
    stops.push({ offset, color: interpolateColor(inTune, slightOutOfTune, t) })
  }
  stops.push({ offset: slightEnd, color: slightOutOfTune })

  const outOfTuneStart = 100 - outOfTuneEnd
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = slightEnd + t * (outOfTuneStart - slightEnd)
    stops.push({ offset, color: interpolateColor(slightOutOfTune, outOfTune, t) })
  }
  stops.push({ offset: outOfTuneStart, color: outOfTune })
  stops.push({ offset: 100, color: outOfTune })

  return stops.map((s) => ({ offset: `${s.offset}%`, color: s.color }))
}

const GRADIENT_STOPS = generateTunerGradientStops()

interface DataPoint {
  cents: number
  isActive: boolean
}

class CircularBuffer {
  private buffer: DataPoint[]
  private _head: number = 0
  private _version: number = 0
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

  getAt(logicalIndex: number): DataPoint {
    const physicalIndex = (this._head + logicalIndex) % this.capacity
    return this.buffer[physicalIndex]
  }
}

function centsToX(cents: number, chartWidth: number): number {
  const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, cents))
  return ((clamped + CENTS_RANGE) / (CENTS_RANGE * 2)) * chartWidth
}

interface SeismographChartProps {
  buffer: CircularBuffer
  bufferVersion: number
  currentCents: number | null
  chartWidth: number
  chartHeight: number
  smoothing?: number
  inTune: boolean
}

function SeismographChart({
  buffer,
  bufferVersion,
  currentCents,
  chartWidth,
  chartHeight,
  smoothing = DEFAULT_SMOOTHING,
  inTune,
}: SeismographChartProps) {
  const dimensions = useMemo(
    () => ({
      fullOutOfTuneXLeft: (chartWidth * (50 - IN_TUNE_CENTS * 3)) / 100,
      fullOutOfTuneXRight: (chartWidth * (50 + IN_TUNE_CENTS * 3)) / 100,
      fullInTuneXLeft: (chartWidth * (50 - IN_TUNE_CENTS)) / 100,
      fullInTuneXRight: (chartWidth * (50 + IN_TUNE_CENTS)) / 100,
    }),
    [chartWidth],
  )

  const indicatorX = useMemo(() => {
    if (currentCents === null) return chartWidth / 2
    const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, currentCents))
    return ((clamped + CENTS_RANGE) / (CENTS_RANGE * 2)) * chartWidth
  }, [currentCents, chartWidth])

  const pathSegments = useMemo(() => {
    const segments: string[] = []
    const segmentHeight = chartHeight / MAX_POINTS

    interface PointData {
      x: number
      y: number
    }

    let currentPoints: PointData[] = []

    const buildSmoothPath = (points: PointData[]): string => {
      if (points.length < 2) return ""
      if (points.length === 2) {
        return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`
      }

      let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[Math.min(points.length - 1, i + 2)]

        const cp1x = p1.x + (p2.x - p0.x) * smoothing
        const cp1y = p1.y + (p2.y - p0.y) * smoothing
        const cp2x = p2.x - (p3.x - p1.x) * smoothing
        const cp2y = p2.y - (p3.y - p1.y) * smoothing

        path += `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
      }

      return path
    }

    const flushSegment = () => {
      if (currentPoints.length >= 2) {
        segments.push(buildSmoothPath(currentPoints))
      }
      currentPoints = []
    }

    for (let i = 0; i < buffer.capacity; i++) {
      const point = buffer.getAt(i)
      const prevPoint = i > 0 ? buffer.getAt(i - 1) : null

      const centsDelta = prevPoint ? Math.abs(point.cents - prevPoint.cents) : 0
      const isNoteChange = centsDelta > 40

      if (!point.isActive || (prevPoint && (!prevPoint.isActive || isNoteChange))) {
        flushSegment()
        if (point.isActive) {
          const x = centsToX(point.cents, chartWidth)
          const y = (MAX_POINTS - i) * segmentHeight
          currentPoints = [{ x, y }]
        }
        continue
      }

      const x = centsToX(point.cents, chartWidth)
      const y = (MAX_POINTS - i) * segmentHeight
      currentPoints.push({ x, y })
    }

    flushSegment()

    return segments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferVersion, chartWidth, chartHeight, smoothing])

  return (
    <div className="w-full">
      <div className="mb-3 flex justify-between text-xs font-medium tracking-wide">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <span className="text-out-of-tune">|</span> Flat
        </span>
        <span className="text-in-tune text-[10px] tracking-widest uppercase">In Tune</span>
        <span className="text-muted-foreground flex items-center gap-1.5">
          Sharp <span className="text-out-of-tune">|</span>
        </span>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl" style={{ height: chartHeight }}>
        <svg
          width={chartWidth}
          height={chartHeight}
          className="bg-background-elevated absolute top-0 left-0 border"
          style={{ width: "100%", height: "100%", borderRadius: "inherit" }}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
        >
          <rect
            x={dimensions.fullInTuneXLeft}
            y={0}
            width={dimensions.fullInTuneXRight - dimensions.fullInTuneXLeft}
            height={chartHeight}
            className="fill-[hsl(150deg_96%_45%)]/8"
          />
          <line
            x1={chartWidth / 2}
            y1={0}
            x2={chartWidth / 2}
            y2={chartHeight}
            className="stroke-[hsl(150deg_96%_45%)]/60"
            strokeWidth={2}
            strokeDasharray="4 4"
          />

          <line
            x1={dimensions.fullOutOfTuneXLeft}
            y1={0}
            x2={dimensions.fullOutOfTuneXLeft}
            y2={chartHeight}
            className="stroke-border"
            strokeWidth={1}
          />
          <line
            x1={dimensions.fullOutOfTuneXRight}
            y1={0}
            x2={dimensions.fullOutOfTuneXRight}
            y2={chartHeight}
            className="stroke-border"
            strokeWidth={1}
          />

          <defs>
            <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
              {GRADIENT_STOPS.map((stop, idx) => (
                <stop key={idx} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
            <mask id="dashboard-tuner-line-mask">
              {pathSegments.map((d, idx) => (
                <path
                  key={idx}
                  d={d}
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
            </mask>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect
            x={0}
            y={0}
            width={chartWidth}
            height={chartHeight}
            fill={`url(#${GRADIENT_ID})`}
            mask="url(#dashboard-tuner-line-mask)"
          />

          {currentCents !== null && (
            <g filter="url(#glow)">
              <circle
                cx={0}
                cy={10}
                r={8}
                className={`transition-all ${inTune ? "fill-[hsl(150deg_96%_45%)] stroke-[hsl(150deg_98%_32%)]" : "fill-background stroke-border"}`}
                style={{
                  transform: `translate(${indicatorX}px, 0)`,
                  transitionTimingFunction: "linear",
                  transitionDuration: "25ms",
                }}
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}

export default function TunerDashboard() {
  const [pitch, setPitch] = useState(-1)
  const bufferRef = useRef<CircularBuffer>(new CircularBuffer(MAX_POINTS))
  const [bufferVersion, setBufferVersion] = useState(0)
  const [chartDimensions, setChartDimensions] = useState({ width: 600, height: 400 })
  const [selectedTuning, setSelectedTuning] = useState("standard")
  const [selectedString, setSelectedString] = useState<number | null>(null)
  const [isMicEnabled, setIsMicEnabled] = useState(false)
  const [autoListenInitialized, setAutoListenInitialized] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const { data: userMetadata } = trpc.user.getUserMetadata.useQuery()
  const updateMetadataMutation = trpc.user.updateUserMetadata.useMutation()

  useEffect(() => {
    if (userMetadata?.defaultTuning) {
      const tuningId = getTuningIdFromHalfSteps(userMetadata.defaultTuning)
      setSelectedTuning(tuningId)
    }
  }, [userMetadata])

  const currentTuning = useMemo(
    () => TUNING_PRESETS.find((p) => p.id === selectedTuning) ?? TUNING_PRESETS[0],
    [selectedTuning],
  )

  const handlePitchDetected = useCallback((result: PitchResult) => {
    setPitch(result.frequency)

    const buffer = bufferRef.current
    const cents = result.frequency > 0 ? getCentsDeviation(result.frequency) : null
    if (cents !== null) {
      buffer.push({ cents, isActive: true })
      setBufferVersion(buffer.version)
    }
  }, [])

  const { status, error, startListening, stopListening } = useAutocorrelation({
    onPitchDetected: handlePitchDetected,
  })

  const noteName = getClosestNoteName(pitch)
  const cents = getCentsDeviation(pitch)
  const inTune = Math.abs(cents ?? 10) <= IN_TUNE_CENTS
  const isListening = status === "recording"

  const handleMicToggle = useCallback(() => {
    if (isMicEnabled) {
      stopListening()
      setIsMicEnabled(false)
    } else {
      startListening()
      setIsMicEnabled(true)
    }
  }, [isMicEnabled, startListening, stopListening])

  const handleTuningChange = useCallback(
    (tuningId: string) => {
      setSelectedTuning(tuningId)
      const halfSteps = TUNING_TO_HALF_STEPS[tuningId]
      if (halfSteps) {
        updateMetadataMutation.mutate({ defaultTuning: halfSteps })
      }
    },
    [updateMetadataMutation],
  )

  useEffect(() => {
    const updateDimensions = () => {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect()
        setChartDimensions({
          width: rect.width || 600,
          height: Math.min(rect.width * 0.7, window.innerHeight * 0.5),
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    if (autoListenInitialized) return
    setAutoListenInitialized(true)

    startListening()
    setIsMicEnabled(true)
  }, [autoListenInitialized, startListening])

  const isPermissionDenied =
    status === "error" &&
    (error?.toLowerCase().includes("permission") ||
      error?.toLowerCase().includes("denied") ||
      error?.toLowerCase().includes("notallowed"))

  const handleRequestPermission = useCallback(() => {
    startListening()
    setIsMicEnabled(true)
  }, [startListening])

  return (
    <div className="space-y-6">
      {isPermissionDenied && (
        <div className="bg-destructive/10 border-destructive/20 flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-destructive h-5 w-5 shrink-0" />
            <p className="text-destructive text-sm font-medium">
              Microphone access is required for the tuner to work. Please enable microphone access
              in your browser settings.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestPermission}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
          >
            <Mic className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detected Note</CardTitle>
            </CardHeader>
            <CardContent>
              <TunerNoteDisplay
                note={noteName}
                frequency={pitch > 0 ? pitch : null}
                cents={cents}
                isInTune={inTune}
                isListening={isListening}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Strings</CardTitle>
            </CardHeader>
            <CardContent>
              <StringIndicator
                strings={currentTuning.strings}
                activeString={selectedString}
                detectedNote={noteName}
                detectedFrequency={pitch > 0 ? pitch : null}
                onStringSelect={setSelectedString}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <TunerControls
                status={status}
                error={error}
                isMicEnabled={isMicEnabled}
                selectedTuning={selectedTuning}
                onMicToggle={handleMicToggle}
                onTuningChange={handleTuningChange}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pitch Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={chartContainerRef} className="w-full">
              <SeismographChart
                buffer={bufferRef.current}
                bufferVersion={bufferVersion}
                currentCents={isListening ? cents : null}
                chartWidth={chartDimensions.width}
                chartHeight={chartDimensions.height}
                inTune={inTune}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
