"use client"

import { useNoteDetection } from "@/hooks/useNoteDetection"
import { getCentsDeviation, getClosestNoteName } from "@/lib/audio/utils"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const MAX_POINTS = 100
const UPDATE_INTERVAL_MS = 46.5
const CENTS_RANGE = 50

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

function getColorForCents(cents: number): string {
  const absCents = Math.abs(cents)
  if (absCents > 15) return "#f87171"
  if (absCents > 5) return "#fbbf24"
  return "#4ade80"
}

type TuneState = "inTune" | "sharp" | "flat"

function getTuneState(cents: number): TuneState {
  if (Math.abs(cents) <= 5) return "inTune"
  if (cents > 5) return "sharp"
  return "flat"
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
}

function SeismographChart({
  buffer,
  bufferVersion,
  currentCents,
  chartWidth,
  chartHeight,
}: SeismographChartProps) {
  const [indicatorX, setIndicatorX] = useState(50)

  useEffect(() => {
    if (currentCents !== null) {
      const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, currentCents))
      const percent = ((clamped + CENTS_RANGE) / (CENTS_RANGE * 2)) * 100
      setIndicatorX(percent)
    }
  }, [currentCents])

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

      if (!point.isActive || !prevPoint.isActive) {
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

      const avgCents = (point.cents + prevPoint.cents) / 2
      const color = getColorForCents(avgCents)

      if (color !== currentColor) {
        if (currentPath) {
          segments.push({ d: currentPath, color: currentColor })
        }
        currentPath = `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`
        currentColor = color
      } else {
        if (Math.abs(lastX - x1) < 0.1 && Math.abs(lastY - y1) < 0.1) {
          currentPath += `L${x2.toFixed(1)},${y2.toFixed(1)}`
        } else {
          currentPath += `M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`
        }
      }
      lastX = x2
      lastY = y2
    }

    if (currentPath) {
      segments.push({ d: currentPath, color: currentColor })
    }

    return segments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferVersion, chartWidth, chartHeight])

  const indicatorColor =
    currentCents !== null
      ? getTuneState(currentCents) === "inTune"
        ? "bg-green-400"
        : getTuneState(currentCents) === "sharp"
          ? "bg-yellow-400"
          : "bg-red-400"
      : "bg-gray-400"

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted-foreground">♭ Flat</span>
        <span className="text-green-400">In Tune</span>
        <span className="text-muted-foreground">Sharp ♯</span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl bg-zinc-900"
        style={{ height: chartHeight }}
      >
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-green-400/25" />
        <div className="absolute inset-y-0 left-1/4 w-px bg-white/10" />
        <div className="absolute inset-y-0 left-3/4 w-px bg-white/10" />

        <svg
          width={chartWidth}
          height={chartHeight}
          className="absolute left-0 top-0"
          style={{ width: "100%", height: "100%" }}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
        >
          {pathSegments.map((seg, idx) => (
            <path
              key={idx}
              d={seg.d}
              stroke={seg.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </svg>

        {currentCents !== null && (
          <div
            className="absolute top-0 z-10 -translate-x-1/2 transition-[left] duration-50"
            style={{ left: `${indicatorX}%` }}
          >
            <div className={`h-4 w-4 rounded-full border-2 ${indicatorColor}`} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function TunerGraph() {
  const { status, error, pitch, startListening, stopListening } = useNoteDetection()

  const noteName = getClosestNoteName(pitch)
  const cents = getCentsDeviation(pitch)

  const bufferRef = useRef<CircularBuffer>(new CircularBuffer(MAX_POINTS))
  const [bufferVersion, setBufferVersion] = useState(0)
  const lastUpdateRef = useRef<number>(0)
  const centsRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 })

  centsRef.current = cents

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth
        setDimensions({ width, height: Math.min(400, window.innerHeight * 0.5) })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

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
      buffer.push({ cents: buffer.getLastActiveCents(), isActive: false })
    }
    setBufferVersion(buffer.version)
  }, [])

  useEffect(() => {
    if (status !== "recording") return
    const interval = setInterval(updateDataPoints, UPDATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, updateDataPoints])

  const centsColor =
    cents !== null
      ? getTuneState(cents) === "inTune"
        ? "text-green-400"
        : getTuneState(cents) === "sharp"
          ? "text-yellow-400"
          : "text-red-400"
      : "text-muted-foreground"

  return (
    <div ref={containerRef} className="flex w-full max-w-xl flex-col items-center gap-6 px-4">
      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {status === "idle" && (
        <Button onClick={startListening} size="lg">
          Start Tuning
        </Button>
      )}

      {status === "requesting" && <p className="text-muted-foreground">Requesting microphone access...</p>}

      {status === "recording" && (
        <>
          <div className="flex flex-col items-center">
            <span className="text-7xl font-bold">{noteName ?? "--"}</span>
            <div className="mt-2 flex items-center gap-4">
              <span className="tabular-nums text-muted-foreground">
                {pitch > 0 ? `${pitch.toFixed(1)} Hz` : "-- Hz"}
              </span>
              {cents !== null && (
                <span className={`tabular-nums ${centsColor}`}>
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
          />

          <Button variant="outline" onClick={stopListening}>
            Stop
          </Button>
        </>
      )}
    </div>
  )
}
