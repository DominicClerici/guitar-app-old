"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export interface NoteInterval {
  id: string
  startMs: number
  endMs: number
  string: number | null
}

export const STRING_COLORS: Record<number, string> = {
  0: "#ef4444",
  1: "#f97316",
  2: "#eab308",
  3: "#22c55e",
  4: "#3b82f6",
  5: "#a855f7",
}

const UNLABELED_COLOR = "#6b7280"
const HANDLE_WIDTH = 6
const HANDLE_HIT_ZONE = 8
const MIN_INTERVAL_MS = 50
const CANVAS_HEIGHT = 160

interface WaveformEditorProps {
  audioData: Float32Array
  sampleRate: number
  intervals: NoteInterval[]
  selectedIntervalId: string | null
  playbackPositionMs: number | null
  cropStartMs?: number
  cropEndMs?: number
  isAddingInterval?: boolean
  onIntervalsChange: (intervals: NoteInterval[]) => void
  onIntervalSelect: (id: string | null) => void
  onCropChange?: (startMs: number, endMs: number) => void
  onGapClick?: (startMs: number, endMs: number) => void
  className?: string
}

type DragState =
  | { kind: "interval"; type: "start" | "end"; intervalId: string }
  | { kind: "crop"; type: "start" | "end" }

export function WaveformEditor({
  audioData,
  sampleRate,
  intervals,
  selectedIntervalId,
  playbackPositionMs,
  cropStartMs,
  cropEndMs,
  isAddingInterval,
  onIntervalsChange,
  onIntervalSelect,
  onCropChange,
  onGapClick,
  className,
}: WaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(800)
  const [cursorStyle, setCursorStyle] = useState("default")

  const totalDurationMs = (audioData.length / sampleRate) * 1000

  const msToX = useCallback(
    (ms: number) => (ms / totalDurationMs) * canvasWidth,
    [totalDurationMs, canvasWidth],
  )

  const xToMs = useCallback(
    (x: number) => (x / canvasWidth) * totalDurationMs,
    [totalDurationMs, canvasWidth],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width
        if (width > 0) setCanvasWidth(Math.floor(width))
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const waveformPeaks = useMemo(() => {
    if (canvasWidth <= 0) return []
    const numBuckets = canvasWidth
    const samplesPerBucket = audioData.length / numBuckets
    const peaks: { min: number; max: number }[] = []

    for (let i = 0; i < numBuckets; i++) {
      let min = 1
      let max = -1
      const start = Math.floor(i * samplesPerBucket)
      const end = Math.min(
        Math.floor((i + 1) * samplesPerBucket),
        audioData.length,
      )
      for (let j = start; j < end; j++) {
        if (audioData[j] < min) min = audioData[j]
        if (audioData[j] > max) max = audioData[j]
      }
      peaks.push({ min, max })
    }
    return peaks
  }, [audioData, canvasWidth])

  const hasCrop = cropStartMs !== undefined && cropEndMs !== undefined

  const gaps = useMemo(() => {
    const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs)
    const result: { startMs: number; endMs: number }[] = []
    let cursor = 0

    for (const interval of sorted) {
      if (interval.startMs > cursor + 1) {
        result.push({ startMs: cursor, endMs: interval.startMs })
      }
      cursor = Math.max(cursor, interval.endMs)
    }

    if (cursor < totalDurationMs - 1) {
      result.push({ startMs: cursor, endMs: totalDurationMs })
    }

    return result
  }, [intervals, totalDurationMs])

  const findGapAt = useCallback(
    (x: number): { startMs: number; endMs: number } | null => {
      const ms = xToMs(x)
      for (const gap of gaps) {
        if (ms >= gap.startMs && ms <= gap.endMs) return gap
      }
      return null
    },
    [gaps, xToMs],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformPeaks.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = "#09090b"
    ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT)

    for (const interval of intervals) {
      const x1 = msToX(interval.startMs)
      const x2 = msToX(interval.endMs)
      const color =
        interval.string !== null
          ? STRING_COLORS[interval.string]
          : UNLABELED_COLOR
      const isSelected = interval.id === selectedIntervalId

      ctx.fillStyle = color
      ctx.globalAlpha = isSelected ? 0.35 : 0.15
      ctx.fillRect(x1, 0, x2 - x1, CANVAS_HEIGHT)
      ctx.globalAlpha = 1.0
    }

    const centerY = CANVAS_HEIGHT / 2
    const amplitude = CANVAS_HEIGHT / 2 - 4

    ctx.fillStyle = "#a1a1aa"
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    for (let i = 0; i < waveformPeaks.length; i++) {
      ctx.lineTo(i, centerY + waveformPeaks[i].min * amplitude)
    }
    for (let i = waveformPeaks.length - 1; i >= 0; i--) {
      ctx.lineTo(i, centerY + waveformPeaks[i].max * amplitude)
    }
    ctx.closePath()
    ctx.fill()

    for (const interval of intervals) {
      const color =
        interval.string !== null
          ? STRING_COLORS[interval.string]
          : UNLABELED_COLOR
      const isSelected = interval.id === selectedIntervalId
      const lineWidth = isSelected ? 2 : 1

      for (const edge of [interval.startMs, interval.endMs]) {
        const x = msToX(edge)
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, CANVAS_HEIGHT)
        ctx.stroke()

        ctx.fillStyle = color
        ctx.globalAlpha = 0.8
        ctx.fillRect(x - HANDLE_WIDTH / 2, 0, HANDLE_WIDTH, 12)
        ctx.fillRect(
          x - HANDLE_WIDTH / 2,
          CANVAS_HEIGHT - 12,
          HANDLE_WIDTH,
          12,
        )
        ctx.globalAlpha = 1.0
      }
    }

    if (isAddingInterval && gaps.length > 0) {
      for (const gap of gaps) {
        const x1 = msToX(gap.startMs)
        const x2 = msToX(gap.endMs)

        ctx.fillStyle = "#22c55e"
        ctx.globalAlpha = 0.15
        ctx.fillRect(x1, 0, x2 - x1, CANVAS_HEIGHT)
        ctx.globalAlpha = 1.0

        ctx.setLineDash([4, 4])
        ctx.strokeStyle = "#22c55e"
        ctx.lineWidth = 1
        ctx.strokeRect(x1, 0, x2 - x1, CANVAS_HEIGHT)
        ctx.setLineDash([])
      }
    }

    if (hasCrop) {
      const cropX1 = msToX(cropStartMs)
      const cropX2 = msToX(cropEndMs)

      ctx.fillStyle = "#000000"
      ctx.globalAlpha = 0.6
      ctx.fillRect(0, 0, cropX1, CANVAS_HEIGHT)
      ctx.fillRect(cropX2, 0, canvasWidth - cropX2, CANVAS_HEIGHT)
      ctx.globalAlpha = 1.0

      for (const x of [cropX1, cropX2]) {
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, CANVAS_HEIGHT)
        ctx.stroke()

        ctx.fillStyle = "#ffffff"
        const triangleSize = 6
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x - triangleSize, triangleSize * 2)
        ctx.lineTo(x + triangleSize, triangleSize * 2)
        ctx.closePath()
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(x, CANVAS_HEIGHT)
        ctx.lineTo(x - triangleSize, CANVAS_HEIGHT - triangleSize * 2)
        ctx.lineTo(x + triangleSize, CANVAS_HEIGHT - triangleSize * 2)
        ctx.closePath()
        ctx.fill()
      }
    }

    if (playbackPositionMs !== null) {
      const x = msToX(playbackPositionMs)
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
  }, [
    waveformPeaks,
    intervals,
    selectedIntervalId,
    playbackPositionMs,
    canvasWidth,
    msToX,
    hasCrop,
    cropStartMs,
    cropEndMs,
    isAddingInterval,
    gaps,
  ])

  const findCropHandleAt = useCallback(
    (x: number): "start" | "end" | null => {
      if (!hasCrop) return null
      const cropX1 = msToX(cropStartMs)
      const cropX2 = msToX(cropEndMs)
      if (Math.abs(x - cropX1) <= HANDLE_HIT_ZONE) return "start"
      if (Math.abs(x - cropX2) <= HANDLE_HIT_ZONE) return "end"
      return null
    },
    [hasCrop, cropStartMs, cropEndMs, msToX],
  )

  const findHandleAt = useCallback(
    (
      x: number,
    ): { intervalId: string; type: "start" | "end" } | null => {
      for (const interval of intervals) {
        const startX = msToX(interval.startMs)
        const endX = msToX(interval.endMs)

        if (Math.abs(x - startX) <= HANDLE_HIT_ZONE) {
          return { intervalId: interval.id, type: "start" }
        }
        if (Math.abs(x - endX) <= HANDLE_HIT_ZONE) {
          return { intervalId: interval.id, type: "end" }
        }
      }
      return null
    },
    [intervals, msToX],
  )

  const findIntervalAt = useCallback(
    (x: number): string | null => {
      const ms = xToMs(x)
      for (const interval of intervals) {
        if (ms >= interval.startMs && ms <= interval.endMs) {
          return interval.id
        }
      }
      return null
    },
    [intervals, xToMs],
  )

  const getCanvasX = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    return e.clientX - rect.left
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const x = getCanvasX(e)

      if (isAddingInterval && onGapClick) {
        const gap = findGapAt(x)
        if (gap) onGapClick(gap.startMs, gap.endMs)
        return
      }

      const cropHandle = findCropHandleAt(x)
      if (cropHandle) {
        dragStateRef.current = { kind: "crop", type: cropHandle }
        return
      }

      const handle = findHandleAt(x)
      if (handle) {
        dragStateRef.current = {
          kind: "interval",
          type: handle.type,
          intervalId: handle.intervalId,
        }
        onIntervalSelect(handle.intervalId)
        return
      }

      const intervalId = findIntervalAt(x)
      onIntervalSelect(intervalId)
    },
    [
      getCanvasX,
      isAddingInterval,
      onGapClick,
      findGapAt,
      findCropHandleAt,
      findHandleAt,
      findIntervalAt,
      onIntervalSelect,
    ],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const x = getCanvasX(e)

      if (dragStateRef.current) {
        const drag = dragStateRef.current
        const newMs = Math.max(0, Math.min(xToMs(x), totalDurationMs))

        if (drag.kind === "crop" && hasCrop && onCropChange) {
          const minCropWidth = 500
          if (drag.type === "start") {
            const clamped = Math.min(newMs, cropEndMs - minCropWidth)
            onCropChange(Math.max(0, clamped), cropEndMs)
          } else {
            const clamped = Math.max(newMs, cropStartMs + minCropWidth)
            onCropChange(cropStartMs, Math.min(totalDurationMs, clamped))
          }
          setCursorStyle("col-resize")
          return
        }

        if (drag.kind === "interval") {
          const { type, intervalId } = drag
          const updated = intervals.map((interval) => {
            if (interval.id !== intervalId) return interval

            if (type === "start") {
              const maxStart = interval.endMs - MIN_INTERVAL_MS
              const clamped = Math.min(newMs, maxStart)

              const prevInterval = intervals
                .filter(
                  (i) => i.id !== intervalId && i.endMs <= interval.endMs,
                )
                .sort((a, b) => b.endMs - a.endMs)[0]
              const minStart = prevInterval ? prevInterval.endMs : 0

              return { ...interval, startMs: Math.max(clamped, minStart) }
            } else {
              const minEnd = interval.startMs + MIN_INTERVAL_MS
              const clamped = Math.max(newMs, minEnd)

              const nextInterval = intervals
                .filter(
                  (i) =>
                    i.id !== intervalId && i.startMs >= interval.startMs,
                )
                .sort((a, b) => a.startMs - b.startMs)[0]
              const maxEnd = nextInterval
                ? nextInterval.startMs
                : totalDurationMs

              return { ...interval, endMs: Math.min(clamped, maxEnd) }
            }
          })

          onIntervalsChange(updated)
        }

        setCursorStyle("col-resize")
        return
      }

      if (isAddingInterval) {
        setCursorStyle(findGapAt(x) ? "crosshair" : "not-allowed")
        return
      }

      const cropHandle = findCropHandleAt(x)
      if (cropHandle) {
        setCursorStyle("col-resize")
      } else if (findHandleAt(x)) {
        setCursorStyle("col-resize")
      } else if (findIntervalAt(x)) {
        setCursorStyle("pointer")
      } else {
        setCursorStyle("default")
      }
    },
    [
      getCanvasX,
      xToMs,
      totalDurationMs,
      intervals,
      onIntervalsChange,
      isAddingInterval,
      findGapAt,
      findCropHandleAt,
      findHandleAt,
      findIntervalAt,
      hasCrop,
      cropStartMs,
      cropEndMs,
      onCropChange,
    ],
  )

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragStateRef.current = null
    setCursorStyle("default")
  }, [])

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        style={{
          width: canvasWidth,
          height: CANVAS_HEIGHT,
          cursor: cursorStyle,
        }}
        className="rounded-md"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}
