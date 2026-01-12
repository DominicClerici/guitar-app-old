"use client"

import { useNoteDetection } from "@/hooks/useNoteDetection"
import { getCentsDeviation, getClosestNoteName } from "@/lib/audio/utils"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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

const tuneStateColors: Record<TuneState, string> = {
  inTune: "#4ade80", // green-400
  sharp: "#fbbf24", // amber-400
  flat: "#f87171", // red-400
}

function getColorForCents(cents: number): string {
  return tuneStateColors[getTuneState(cents)]
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
  const indicatorPercent = useMemo(() => {
    if (currentCents === null) return 50
    const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, currentCents))
    return ((clamped + CENTS_RANGE) / (CENTS_RANGE * 2)) * 100
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

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between mb-2">
        <span className="text-xs text-muted-foreground">♭ Flat</span>
        <span className="text-xs text-green-400">In Tune</span>
        <span className="text-xs text-muted-foreground">Sharp ♯</span>
      </div>

      <div
        className="relative w-full rounded-xl bg-card overflow-hidden"
        style={{ height: chartHeight }}
      >
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-green-400/25" />

        {/* Guide lines at 25% and 75% */}
        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-foreground/10" />
        <div className="absolute left-3/4 top-0 bottom-0 w-px bg-foreground/10" />

        {/* SVG for the seismograph line */}
        <svg
          width={chartWidth}
          height={chartHeight}
          className="absolute top-0 left-0"
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

        {/* Current position indicator */}
        {currentCents !== null && (
          <div
            className="absolute top-0 -ml-2 z-10 transition-[left] duration-50 ease-out"
            style={{ left: `${indicatorPercent}%` }}
          >
            <div
              className="w-4 h-4 rounded-full border-2"
              style={{
                backgroundColor: getColorForCents(currentCents),
                borderColor: getColorForCents(currentCents),
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function MicrophoneTestPage() {
  const { status, error, pitch, clarity, sampleRate, startListening, stopListening } =
    useNoteDetection()

  const noteName = getClosestNoteName(pitch)
  const cents = getCentsDeviation(pitch)

  const bufferRef = useRef<CircularBuffer>(new CircularBuffer(MAX_POINTS))
  const [bufferVersion, setBufferVersion] = useState(0)
  const lastUpdateRef = useRef<number>(0)
  const centsRef = useRef<number | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [chartDimensions, setChartDimensions] = useState({ width: 400, height: 400 })

  centsRef.current = cents

  // Measure chart container
  useEffect(() => {
    const updateDimensions = () => {
      if (chartContainerRef.current) {
        const width = chartContainerRef.current.offsetWidth
        setChartDimensions({ width, height: Math.min(400, window.innerHeight * 0.4) })
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

  useEffect(() => {
    startListening()
    return () => stopListening()
  }, [startListening, stopListening])

  const tuneState = cents !== null ? getTuneState(cents) : null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-5">
      <h1 className="text-2xl font-semibold mb-10">Microphone Test</h1>

      {error && (
        <p className="text-destructive mb-5">{error}</p>
      )}

      {status === "requesting" && (
        <p className="text-muted-foreground">Requesting microphone permission...</p>
      )}

      {status === "recording" && (
        <>
          {/* Note display */}
          <div className="text-center mb-8">
            <p className="text-8xl font-bold">{noteName ?? "--"}</p>
            <div className="flex gap-6 justify-center mt-4">
              <p className="text-xl text-muted-foreground tabular-nums">
                {pitch > 0 ? `${pitch.toFixed(1)} Hz` : "-- Hz"}
              </p>
              {cents !== null && (
                <p
                  className="text-xl tabular-nums"
                  style={{ color: tuneStateColors[tuneState!] }}
                >
                  {cents > 0 ? "+" : ""}
                  {cents.toFixed(0)} cents
                </p>
              )}
            </div>
          </div>

          {/* Seismograph chart */}
          <div ref={chartContainerRef} className="w-full max-w-md mb-8">
            <SeismographChart
              buffer={bufferRef.current}
              bufferVersion={bufferVersion}
              currentCents={cents}
              chartWidth={chartDimensions.width}
              chartHeight={chartDimensions.height}
            />
          </div>

          {/* Stats panel */}
          <div className="w-full max-w-md bg-card rounded-xl p-5 border border-border">
            <div className="mb-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-base text-green-400">Recording</p>
            </div>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground">Sample Rate</p>
              <p className="text-base">{sampleRate} Hz</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clarity</p>
              <p className="text-base">{(clarity * 100).toFixed(0)}%</p>
            </div>
          </div>

          {/* Simple tuning indicator bar */}
          <div className="w-full max-w-md mt-8 relative h-14 bg-card rounded-xl">
            {/* Center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-green-400/25" />
            {/* Guide lines */}
            <div className="absolute left-1/4 top-0 bottom-0 w-px bg-foreground/10" />
            <div className="absolute left-3/4 top-0 bottom-0 w-px bg-foreground/10" />

            {/* Position indicator dot */}
            {cents !== null && (
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-[left] duration-50 ease-out"
                style={{
                  left: `${((Math.max(-50, Math.min(50, cents)) + 50) / 100) * 100}%`,
                  backgroundColor: tuneStateColors[tuneState!],
                }}
              />
            )}

            {/* Labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-3 py-2">
              <span className="text-xs text-muted-foreground">♭ Flat</span>
              <span className="text-xs text-green-400">In Tune</span>
              <span className="text-xs text-muted-foreground">Sharp ♯</span>
            </div>
          </div>
        </>
      )}

      <button
        onClick={status === "recording" ? stopListening : startListening}
        className={`mt-10 px-6 py-3 text-base font-medium rounded-lg cursor-pointer transition-colors ${
          status === "recording"
            ? "bg-red-400 hover:bg-red-500 text-black"
            : "bg-green-400 hover:bg-green-500 text-black"
        }`}
      >
        {status === "recording" ? "Stop" : "Start"}
      </button>
    </div>
  )
}
