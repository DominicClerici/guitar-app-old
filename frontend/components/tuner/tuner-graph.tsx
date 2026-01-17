"use client"

import { type PitchData, useNoteDetection } from "@/hooks/useNoteDetection"
import { getCentsDeviation, getClosestNoteName } from "@/lib/audio/utils"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const MAX_POINTS = 200
const CENTS_RANGE = 50
const DEFAULT_SMOOTHING = 0.2
const IN_TUNE_CENTS = 8

const GRADIENT_ID = "tuner-gradient"

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
    // For CSS variable interpolation, we use color-mix
    const eased = easeInOutCubic(t)
    const toPercent = Math.round(eased * 100)
    return `color-mix(in oklch, ${to} ${toPercent}%, ${from})`
  }

  // Left side: 0% to 50%
  // 0% - pure out-of-tune
  stops.push({ offset: 0, color: outOfTune })

  // Out-of-tune stays solid until 12%, then transitions to slight-out-of-tune
  const outOfTuneEnd = 12
  stops.push({ offset: outOfTuneEnd, color: outOfTune })

  // Transition from out-of-tune to slight-out-of-tune (12% to 35%)
  const slightStart = 50 - slightOutPercent // 35%
  const numTransitionStops = 4
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = outOfTuneEnd + t * (slightStart - outOfTuneEnd)
    stops.push({ offset, color: interpolateColor(outOfTune, slightOutOfTune, t) })
  }
  stops.push({ offset: slightStart, color: slightOutOfTune })

  // Transition from slight-out-of-tune to in-tune (35% to 46%)
  const inTuneStart = 50 - inTunePercent // 46%
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = slightStart + t * (inTuneStart - slightStart)
    stops.push({ offset, color: interpolateColor(slightOutOfTune, inTune, t) })
  }
  stops.push({ offset: inTuneStart, color: inTune })

  // Center: in-tune zone (46% to 54%)
  stops.push({ offset: 50, color: inTune })
  const inTuneEnd = 50 + inTunePercent // 54%
  stops.push({ offset: inTuneEnd, color: inTune })

  // Right side mirrors left: 50% to 100%
  // Transition from in-tune to slight-out-of-tune (54% to 65%)
  const slightEnd = 50 + slightOutPercent // 65%
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = inTuneEnd + t * (slightEnd - inTuneEnd)
    stops.push({ offset, color: interpolateColor(inTune, slightOutOfTune, t) })
  }
  stops.push({ offset: slightEnd, color: slightOutOfTune })

  // Transition from slight-out-of-tune to out-of-tune (65% to 88%)
  const outOfTuneStart = 100 - outOfTuneEnd // 88%
  for (let i = 1; i <= numTransitionStops; i++) {
    const t = i / (numTransitionStops + 1)
    const offset = slightEnd + t * (outOfTuneStart - slightEnd)
    stops.push({ offset, color: interpolateColor(slightOutOfTune, outOfTune, t) })
  }
  stops.push({ offset: outOfTuneStart, color: outOfTune })

  // Out-of-tune stays solid from 88% to 100%
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
  bufferDurationMs: number
}

function SeismographChart({
  buffer,
  bufferVersion,
  currentCents,
  chartWidth,
  chartHeight,
  smoothing = DEFAULT_SMOOTHING,
  inTune,
  bufferDurationMs,
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
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted-foreground">♭ Flat</span>
        <span className="text-muted-foreground">Sharp ♯</span>
      </div>

      <div className="relative w-full" style={{ height: chartHeight }}>
        <svg
          width={chartWidth}
          height={chartHeight}
          className="bg-background-elevated absolute top-0 left-0 rounded-xl border"
          style={{ width: "100%", height: "100%" }}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
        >
          {/* in tune lines */}

          <rect
            x={dimensions.fullInTuneXLeft}
            y={0}
            width={dimensions.fullInTuneXRight - dimensions.fullInTuneXLeft}
            height={chartHeight}
            className="fill-[hsl(150deg_96%_45%)]/10"
          />
          <line
            x1={chartWidth / 2}
            y1={0}
            x2={chartWidth / 2}
            y2={chartHeight}
            className="stroke-[hsl(150deg_96%_45%)]"
            strokeWidth={1}
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
            <mask id="tuner-line-mask">
              {pathSegments.map((d, idx) => (
                <path
                  key={idx}
                  d={d}
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
            </mask>
          </defs>

          <rect
            x={0}
            y={0}
            width={chartWidth}
            height={chartHeight}
            fill={`url(#${GRADIENT_ID})`}
            mask="url(#tuner-line-mask)"
          />

          {currentCents !== null && (
            <circle
              cx={0}
              cy={7}
              r={6}
              className={`transition-all ${inTune ? "fill-[hsl(150deg_96%_45%)] stroke-[hsl(150deg_98%_32%)]" : "fill-background stroke-border"}`}
              style={{
                transform: `translate(${indicatorX}px, 0)`,
                transitionTimingFunction: "linear",
                transitionDuration: `${bufferDurationMs}ms`,
              }}
              strokeWidth={1}
            />
          )}
        </svg>
      </div>
    </div>
  )
}

export default function TunerGraph() {
  const [pitch, setPitch] = useState(-1)
  const [, setClarity] = useState(0)
  const bufferRef = useRef<CircularBuffer>(new CircularBuffer(MAX_POINTS))
  const [bufferVersion, setBufferVersion] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 500, height: 800 })

  const handlePitchDetected = useCallback((data: PitchData) => {
    setPitch(data.pitch)
    setClarity(data.clarity)

    const buffer = bufferRef.current
    const cents = data.pitch > 0 ? getCentsDeviation(data.pitch) : null
    if (cents !== null) {
      buffer.push({ cents, isActive: true })
      setBufferVersion(buffer.version)
    }
  }, [])

  const { status, error, startListening, bufferDurationMs } = useNoteDetection({
    onPitchDetected: handlePitchDetected,
  })

  const noteName = getClosestNoteName(pitch)
  const cents = getCentsDeviation(pitch)

  useEffect(() => {
    startListening()
  }, [startListening])

  useEffect(() => {
    const updateDimensions = () => {
      if (window.innerHeight) {
        setDimensions({ width: 500, height: window.innerHeight * 0.6 })
      }
    }
    updateDimensions()
  }, [])

  const inTune = Math.abs(cents || 10) <= IN_TUNE_CENTS

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6 px-4">
      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {(status === "idle" || status === "requesting") && (
        <p className="text-muted-foreground">Requesting microphone access...</p>
      )}

      {status === "recording" && (
        <>
          <div className="flex flex-col items-center">
            <span className="text-7xl font-bold">{noteName ?? "--"}</span>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-muted-foreground tabular-nums">
                {pitch > 0 ? `${pitch.toFixed(1)} Hz` : "-- Hz"}
              </span>
              {cents !== null && (
                <span
                  className={`tabular-nums ${inTune ? "text-green-500" : "text-muted-foreground"}`}
                >
                  {cents > 0 ? "+" : ""}
                  {cents.toFixed(0)} cents
                </span>
              )}
            </div>
          </div>

          <SeismographChart
            buffer={bufferRef.current}
            bufferVersion={bufferVersion}
            currentCents={cents}
            chartWidth={dimensions.width}
            chartHeight={dimensions.height}
            inTune={inTune}
            bufferDurationMs={bufferDurationMs}
          />
        </>
      )}
    </div>
  )
}
