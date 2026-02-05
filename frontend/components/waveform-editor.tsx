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
const ROW_DURATION_MS = 10000

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

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
  onSeek?: (ms: number) => void
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
  onSeek,
  className,
}: WaveformEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const dragStateRef = useRef<DragState | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(800)
  const [cursorStyle, setCursorStyle] = useState("default")

  const totalDurationMs = (audioData.length / sampleRate) * 1000

  const rows = useMemo(() => {
    const numRows = Math.max(1, Math.ceil(totalDurationMs / ROW_DURATION_MS))
    return Array.from({ length: numRows }, (_, i) => ({
      startMs: i * ROW_DURATION_MS,
      endMs: Math.min((i + 1) * ROW_DURATION_MS, totalDurationMs),
    }))
  }, [totalDurationMs])

  const msToXInRow = useCallback(
    (ms: number, rowStartMs: number, rowEndMs: number) =>
      ((ms - rowStartMs) / (rowEndMs - rowStartMs)) * canvasWidth,
    [canvasWidth],
  )

  const xToMsInRow = useCallback(
    (x: number, rowStartMs: number, rowEndMs: number) =>
      rowStartMs + (x / canvasWidth) * (rowEndMs - rowStartMs),
    [canvasWidth],
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

  const rowPeaks = useMemo(() => {
    if (canvasWidth <= 0) return []
    return rows.map((row) => {
      const startSample = Math.floor((row.startMs / 1000) * sampleRate)
      const endSample = Math.min(
        Math.floor((row.endMs / 1000) * sampleRate),
        audioData.length,
      )
      const totalSamples = endSample - startSample
      const samplesPerBucket = totalSamples / canvasWidth
      const peaks: { min: number; max: number }[] = []

      for (let i = 0; i < canvasWidth; i++) {
        let min = 1
        let max = -1
        const bStart = startSample + Math.floor(i * samplesPerBucket)
        const bEnd = Math.min(
          startSample + Math.floor((i + 1) * samplesPerBucket),
          endSample,
        )
        for (let j = bStart; j < bEnd; j++) {
          if (audioData[j] < min) min = audioData[j]
          if (audioData[j] > max) max = audioData[j]
        }
        peaks.push({ min, max })
      }
      return peaks
    })
  }, [audioData, sampleRate, canvasWidth, rows])

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
    (x: number, rowIndex: number) => {
      const row = rows[rowIndex]
      if (!row) return null
      const ms = xToMsInRow(x, row.startMs, row.endMs)
      for (const gap of gaps) {
        if (ms >= gap.startMs && ms <= gap.endMs) return gap
      }
      return null
    },
    [gaps, xToMsInRow, rows],
  )

  const findCropHandleAt = useCallback(
    (x: number, rowIndex: number): "start" | "end" | null => {
      if (!hasCrop) return null
      const row = rows[rowIndex]
      if (!row) return null
      if (cropStartMs >= row.startMs && cropStartMs < row.endMs) {
        if (Math.abs(x - msToXInRow(cropStartMs, row.startMs, row.endMs)) <= HANDLE_HIT_ZONE)
          return "start"
      }
      if (cropEndMs > row.startMs && cropEndMs <= row.endMs) {
        if (Math.abs(x - msToXInRow(cropEndMs, row.startMs, row.endMs)) <= HANDLE_HIT_ZONE)
          return "end"
      }
      return null
    },
    [hasCrop, cropStartMs, cropEndMs, msToXInRow, rows],
  )

  const findHandleAt = useCallback(
    (x: number, rowIndex: number): { intervalId: string; type: "start" | "end" } | null => {
      const row = rows[rowIndex]
      if (!row) return null
      for (const interval of intervals) {
        if (interval.startMs >= row.startMs && interval.startMs < row.endMs) {
          if (Math.abs(x - msToXInRow(interval.startMs, row.startMs, row.endMs)) <= HANDLE_HIT_ZONE)
            return { intervalId: interval.id, type: "start" }
        }
        if (interval.endMs > row.startMs && interval.endMs <= row.endMs) {
          if (Math.abs(x - msToXInRow(interval.endMs, row.startMs, row.endMs)) <= HANDLE_HIT_ZONE)
            return { intervalId: interval.id, type: "end" }
        }
      }
      return null
    },
    [intervals, msToXInRow, rows],
  )

  const findIntervalAt = useCallback(
    (x: number, rowIndex: number): string | null => {
      const row = rows[rowIndex]
      if (!row) return null
      const ms = xToMsInRow(x, row.startMs, row.endMs)
      for (const interval of intervals) {
        if (ms >= interval.startMs && ms <= interval.endMs) return interval.id
      }
      return null
    },
    [intervals, xToMsInRow, rows],
  )

  const getCanvasX = useCallback((e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    return e.clientX - rect.left
  }, [])

  // Drawing
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const canvas = canvasRefs.current.get(rowIndex)
      const peaks = rowPeaks[rowIndex]
      if (!canvas || !peaks || peaks.length === 0) continue

      const row = rows[rowIndex]
      const ctx = canvas.getContext("2d")
      if (!ctx) continue

      canvas.width = canvasWidth * dpr
      canvas.height = CANVAS_HEIGHT * dpr
      ctx.scale(dpr, dpr)

      const toX = (ms: number) => msToXInRow(ms, row.startMs, row.endMs)

      // Background
      ctx.fillStyle = "#09090b"
      ctx.fillRect(0, 0, canvasWidth, CANVAS_HEIGHT)

      // Interval backgrounds
      for (const interval of intervals) {
        if (interval.endMs <= row.startMs || interval.startMs >= row.endMs) continue
        const x1 = toX(Math.max(interval.startMs, row.startMs))
        const x2 = toX(Math.min(interval.endMs, row.endMs))
        const color = interval.string !== null ? STRING_COLORS[interval.string] : UNLABELED_COLOR
        const isSelected = interval.id === selectedIntervalId

        ctx.fillStyle = color
        ctx.globalAlpha = isSelected ? 0.35 : 0.15
        ctx.fillRect(x1, 0, x2 - x1, CANVAS_HEIGHT)
        ctx.globalAlpha = 1.0
      }

      // Waveform
      const centerY = CANVAS_HEIGHT / 2
      const amplitude = CANVAS_HEIGHT / 2 - 4

      ctx.fillStyle = "#a1a1aa"
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      for (let i = 0; i < peaks.length; i++) {
        ctx.lineTo(i, centerY + peaks[i].min * amplitude)
      }
      for (let i = peaks.length - 1; i >= 0; i--) {
        ctx.lineTo(i, centerY + peaks[i].max * amplitude)
      }
      ctx.closePath()
      ctx.fill()

      // Interval edges and handles
      for (const interval of intervals) {
        if (interval.endMs <= row.startMs || interval.startMs >= row.endMs) continue
        const color = interval.string !== null ? STRING_COLORS[interval.string] : UNLABELED_COLOR
        const isSelected = interval.id === selectedIntervalId
        const lineWidth = isSelected ? 2 : 1

        const edges: number[] = []
        if (interval.startMs >= row.startMs && interval.startMs < row.endMs)
          edges.push(interval.startMs)
        if (interval.endMs > row.startMs && interval.endMs <= row.endMs)
          edges.push(interval.endMs)

        for (const edgeMs of edges) {
          const x = toX(edgeMs)
          ctx.strokeStyle = color
          ctx.lineWidth = lineWidth
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, CANVAS_HEIGHT)
          ctx.stroke()

          ctx.fillStyle = color
          ctx.globalAlpha = 0.8
          ctx.fillRect(x - HANDLE_WIDTH / 2, 0, HANDLE_WIDTH, 12)
          ctx.fillRect(x - HANDLE_WIDTH / 2, CANVAS_HEIGHT - 12, HANDLE_WIDTH, 12)
          ctx.globalAlpha = 1.0
        }
      }

      // Gap highlights
      if (isAddingInterval && gaps.length > 0) {
        for (const gap of gaps) {
          if (gap.endMs <= row.startMs || gap.startMs >= row.endMs) continue
          const x1 = toX(Math.max(gap.startMs, row.startMs))
          const x2 = toX(Math.min(gap.endMs, row.endMs))

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

      // Crop overlay
      if (hasCrop) {
        const leftDarkEnd = Math.max(row.startMs, Math.min(cropStartMs, row.endMs))
        const rightDarkStart = Math.max(row.startMs, Math.min(cropEndMs, row.endMs))

        if (leftDarkEnd > row.startMs) {
          ctx.fillStyle = "#000000"
          ctx.globalAlpha = 0.6
          ctx.fillRect(0, 0, toX(leftDarkEnd), CANVAS_HEIGHT)
          ctx.globalAlpha = 1.0
        }

        if (rightDarkStart < row.endMs) {
          const x = toX(rightDarkStart)
          ctx.fillStyle = "#000000"
          ctx.globalAlpha = 0.6
          ctx.fillRect(x, 0, canvasWidth - x, CANVAS_HEIGHT)
          ctx.globalAlpha = 1.0
        }

        // Crop handle lines and triangles
        const cropEdges: number[] = []
        if (cropStartMs >= row.startMs && cropStartMs < row.endMs)
          cropEdges.push(cropStartMs)
        if (cropEndMs > row.startMs && cropEndMs <= row.endMs)
          cropEdges.push(cropEndMs)

        for (const edgeMs of cropEdges) {
          const x = toX(edgeMs)
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

      // Playback cursor
      if (
        playbackPositionMs !== null &&
        playbackPositionMs >= row.startMs &&
        playbackPositionMs <= row.endMs
      ) {
        const x = toX(playbackPositionMs)
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, CANVAS_HEIGHT)
        ctx.stroke()
      }

      // Time labels
      ctx.fillStyle = "#ffffff"
      ctx.globalAlpha = 0.5
      ctx.font = "11px monospace"
      ctx.textAlign = "left"
      ctx.fillText(formatTime(row.startMs), 4, 14)
      ctx.textAlign = "right"
      ctx.fillText(formatTime(row.endMs), canvasWidth - 4, 14)
      ctx.textAlign = "left"
      ctx.globalAlpha = 1.0
    }
  }, [
    rows,
    rowPeaks,
    intervals,
    selectedIntervalId,
    playbackPositionMs,
    canvasWidth,
    msToXInRow,
    hasCrop,
    cropStartMs,
    cropEndMs,
    isAddingInterval,
    gaps,
  ])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      const x = getCanvasX(e)
      const row = rows[rowIndex]

      if (isAddingInterval && onGapClick) {
        const gap = findGapAt(x, rowIndex)
        if (gap) onGapClick(gap.startMs, gap.endMs)
        return
      }

      const cropHandle = findCropHandleAt(x, rowIndex)
      if (cropHandle) {
        dragStateRef.current = { kind: "crop", type: cropHandle }
        return
      }

      const handle = findHandleAt(x, rowIndex)
      if (handle) {
        dragStateRef.current = {
          kind: "interval",
          type: handle.type,
          intervalId: handle.intervalId,
        }
        onIntervalSelect(handle.intervalId)
        return
      }

      const intervalId = findIntervalAt(x, rowIndex)
      onIntervalSelect(intervalId)
      onSeek?.(xToMsInRow(x, row.startMs, row.endMs))
    },
    [
      getCanvasX,
      rows,
      isAddingInterval,
      onGapClick,
      findGapAt,
      findCropHandleAt,
      findHandleAt,
      findIntervalAt,
      onIntervalSelect,
      onSeek,
      xToMsInRow,
    ],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, rowIndex: number) => {
      const x = getCanvasX(e)
      const row = rows[rowIndex]

      if (dragStateRef.current) {
        const drag = dragStateRef.current
        const newMs = Math.max(
          0,
          Math.min(xToMsInRow(x, row.startMs, row.endMs), totalDurationMs),
        )

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
        setCursorStyle(findGapAt(x, rowIndex) ? "crosshair" : "not-allowed")
        return
      }

      const cropHandle = findCropHandleAt(x, rowIndex)
      if (cropHandle) {
        setCursorStyle("col-resize")
      } else if (findHandleAt(x, rowIndex)) {
        setCursorStyle("col-resize")
      } else if (findIntervalAt(x, rowIndex)) {
        setCursorStyle("pointer")
      } else {
        setCursorStyle("default")
      }
    },
    [
      getCanvasX,
      rows,
      xToMsInRow,
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
      <div className="flex flex-col gap-1">
        {rows.map((_, index) => (
          <canvas
            key={index}
            ref={(el) => {
              if (el) canvasRefs.current.set(index, el)
              else canvasRefs.current.delete(index)
            }}
            style={{
              width: canvasWidth,
              height: CANVAS_HEIGHT,
              cursor: cursorStyle,
            }}
            className="rounded-md"
            onMouseDown={(e) => handleMouseDown(e, index)}
            onMouseMove={(e) => handleMouseMove(e, index)}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </div>
    </div>
  )
}
