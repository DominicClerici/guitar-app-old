import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PlayIcon, SquareIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import { PreviewControls, StrumDirection, StrumNote } from "./strum-pattern-dialog"

type RecordingState = "idle" | "countdown" | "recording" | "complete"
type SnapInterval = "4n" | "8n" | "16n" | "32n" | "64n" | null

interface StrumPatternDetectorProps {
  setStrumPattern: React.Dispatch<React.SetStateAction<StrumNote[]>>
  bpm: number
  barDurationMs: number
  recordingState: RecordingState
  setRecordingState: React.Dispatch<React.SetStateAction<RecordingState>>
  originalClicks: StrumNote[]
  snappedClicks: StrumNote[] | null
  activeSnapInterval: SnapInterval | null
  setOriginalClicks: React.Dispatch<React.SetStateAction<StrumNote[]>>
  setSnappedClicks: React.Dispatch<React.SetStateAction<StrumNote[] | null>>
  setActiveSnapInterval: React.Dispatch<React.SetStateAction<SnapInterval | null>>
  previewControls: PreviewControls
}

export default function StrumPatternDetector({
  setStrumPattern,
  bpm,
  barDurationMs,
  recordingState,
  setRecordingState,
  originalClicks,
  snappedClicks,
  activeSnapInterval,
  setOriginalClicks,
  setSnappedClicks,
  setActiveSnapInterval,
  previewControls,
}: StrumPatternDetectorProps) {
  const { isPreviewingPattern, previewProgress, startPreview, stopPreview } = previewControls

  const [countdownValue, setCountdownValue] = useState(4)
  const [recordingProgress, setRecordingProgress] = useState(0)

  // The clicks to display/save - use snapped if available, otherwise original
  const displayClicks = snappedClicks ?? originalClicks
  const isShowingSnapped = snappedClicks !== null

  const barStartTimeRef = useRef<number>(0)
  const metronomeRef = useRef<Tone.Synth | null>(null)
  const sequenceRef = useRef<Tone.Sequence | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup function for recording
  const cleanup = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    if (sequenceRef.current) {
      sequenceRef.current.stop()
      sequenceRef.current.dispose()
      sequenceRef.current = null
    }
    if (metronomeRef.current) {
      metronomeRef.current.dispose()
      metronomeRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  const startRecording = async () => {
    await Tone.start()
    setOriginalClicks([])
    setSnappedClicks(null)
    setActiveSnapInterval(null)
    setRecordingState("countdown")
    setCountdownValue(4)

    // Create metronome synth for countdown
    metronomeRef.current = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
    }).toDestination()

    // Calculate beat duration based on BPM
    const beatDurationMs = (60 / bpm) * 1000

    // Countdown: 4, 3, 2, 1 (one full bar at the current BPM)
    let count = 4

    // Play first beat immediately
    metronomeRef.current.triggerAttackRelease(1200, "32n")

    countdownIntervalRef.current = setInterval(() => {
      count--
      if (count > 0) {
        setCountdownValue(count)
        // Play countdown metronome beat
        if (metronomeRef.current) {
          metronomeRef.current.triggerAttackRelease(1200, "32n")
        }
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        beginRecordingPhase()
      }
    }, beatDurationMs)
  }

  const beginRecordingPhase = () => {
    setRecordingState("recording")
    setRecordingProgress(0)

    // Metronome synth is already created during countdown, reuse it
    Tone.getTransport().bpm.value = bpm

    // Create metronome sequence (4 beats)
    sequenceRef.current = new Tone.Sequence(
      (time, beat) => {
        if (metronomeRef.current) {
          // First beat is higher pitch
          const freq = beat === 0 ? 1000 : 800
          metronomeRef.current.triggerAttackRelease(freq, "32n", time)
        }
      },
      [0, 1, 2, 3],
      "4n",
    )

    sequenceRef.current.loop = false
    sequenceRef.current.start(0)

    // Record the exact start time
    barStartTimeRef.current = performance.now()

    Tone.getTransport().start()

    // Update progress animation
    const updateProgress = () => {
      const elapsed = performance.now() - barStartTimeRef.current
      const progress = Math.min(elapsed / barDurationMs, 1)
      setRecordingProgress(progress)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateProgress)
      } else {
        finishRecording()
      }
    }
    animationFrameRef.current = requestAnimationFrame(updateProgress)
  }

  const finishRecording = () => {
    cleanup()
    setRecordingState("complete")
    setRecordingProgress(1)
  }

  const handleCardClick = () => {
    if (recordingState !== "recording") return

    const elapsed = performance.now() - barStartTimeRef.current
    const normalizedPosition = Math.max(0, Math.min(1, elapsed / barDurationMs))

    setOriginalClicks((prev) => [
      ...prev,
      { position: normalizedPosition, direction: "down" as StrumDirection },
    ])
  }

  const toggleNoteDirection = (index: number) => {
    // Only allow toggling when viewing the appropriate layer
    if (isShowingSnapped) {
      // Toggle snapped note direction
      setSnappedClicks((prev) => {
        if (!prev) return prev
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          direction: updated[index].direction === "down" ? "up" : "down",
        }
        return updated
      })
    } else {
      // Toggle original note direction
      setOriginalClicks((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          direction: updated[index].direction === "down" ? "up" : "down",
        }
        return updated
      })
    }
  }

  const handleSavePattern = () => {
    stopPreview()
    setStrumPattern(displayClicks)
    setRecordingState("idle")
    setOriginalClicks([])
    setSnappedClicks(null)
    setActiveSnapInterval(null)
  }

  // Snap clicks to a given musical subdivision
  const snapToInterval = (subdivision: SnapInterval) => {
    if (!subdivision || originalClicks.length === 0) {
      setSnappedClicks(null)
      setActiveSnapInterval(null)
      return
    }

    setActiveSnapInterval(subdivision)

    // First, calculate snapped positions for each original click
    const snappedWithDirections = originalClicks.map((note) => {
      // Calculate the interval duration as a fraction of the bar
      // e.g., "4n" = 4 slots per bar, so each slot is 1/4 = 0.25
      const intervalMap: Record<string, number> = {
        "4n": 4,
        "8n": 8,
        "16n": 16,
        "32n": 32,
        "64n": 64,
      }
      const numSlots = intervalMap[subdivision] || 4
      const intervalSize = 1 / numSlots

      // Snap to the START of the interval by flooring to the nearest interval boundary
      const slotIndex = Math.floor(note.position / intervalSize)
      const normalizedQuantized = Math.max(0, Math.min(1 - intervalSize, slotIndex * intervalSize))

      return {
        position: normalizedQuantized,
        direction: note.direction,
      }
    })

    // Group by position and resolve direction conflicts
    const positionMap = new Map<number, { upCount: number; downCount: number }>()

    for (const note of snappedWithDirections) {
      const key = note.position
      const existing = positionMap.get(key) || { upCount: 0, downCount: 0 }
      if (note.direction === "up") {
        existing.upCount++
      } else {
        existing.downCount++
      }
      positionMap.set(key, existing)
    }

    // Create unique snapped notes with majority direction (prefer down on tie)
    const uniqueSnapped: StrumNote[] = []
    for (const [position, counts] of positionMap.entries()) {
      const direction: StrumDirection = counts.upCount > counts.downCount ? "up" : "down"
      uniqueSnapped.push({ position, direction })
    }

    // Sort by position
    uniqueSnapped.sort((a, b) => a.position - b.position)

    setSnappedClicks(uniqueSnapped)
  }

  const clearSnap = () => {
    setSnappedClicks(null)
    setActiveSnapInterval(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* BPM display */}
      <div className="text-muted-foreground text-center text-sm">
        Recording at {bpm} BPM (1 bar = {(barDurationMs / 1000).toFixed(1)}
        s)
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Down strum</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-orange-500" />
          <span className="text-muted-foreground">Up strum</span>
        </div>
      </div>

      {/* Recording card */}
      <div
        onClick={handleCardClick}
        className={`relative h-32 cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
          recordingState === "recording"
            ? "border-primary bg-primary/5"
            : recordingState === "countdown"
              ? "border-yellow-500 bg-yellow-500/5"
              : "border-border bg-muted/50 hover:border-muted-foreground/50"
        }`}
      >
        {/* Progress bar during recording */}
        {recordingState === "recording" && (
          <div
            className="bg-primary/20 absolute top-0 left-0 h-full transition-none"
            style={{ width: `${recordingProgress * 100}%` }}
          />
        )}

        {/* Progress bar during preview of recorded pattern */}
        {isPreviewingPattern && (
          <div
            className="absolute top-0 left-0 h-full bg-green-500/20 transition-none"
            style={{ width: `${previewProgress * 100}%` }}
          />
        )}

        {/* Beat markers */}
        <div className="absolute top-0 right-0 left-0 flex h-full">
          {[0, 1, 2, 3].map((beat) => (
            <div
              key={beat}
              className="border-muted-foreground/30 flex-1 border-r border-dashed last:border-r-0"
            >
              <span className="text-muted-foreground/50 ml-1 text-xs">{beat + 1}</span>
            </div>
          ))}
        </div>

        {/* Original click markers (shown grayed out when snapping is active) */}
        {snappedClicks &&
          originalClicks.map((note, index) => (
            <div
              key={`original-${index}`}
              className={`border-muted-foreground/20 absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 ${
                note.direction === "down" ? "bg-blue-500/30" : "bg-orange-500/30"
              }`}
              style={{ left: `calc(${note.position * 100}% - 6px)` }}
            />
          ))}

        {/* Click markers (snapped or original) - interactive */}
        {displayClicks.map((note, index) => (
          <div
            key={index}
            className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 shadow-md transition-transform duration-150 ${
              note.direction === "down"
                ? "border-blue-300 bg-blue-500"
                : "border-orange-300 bg-orange-500"
            } ${recordingState === "complete" ? "cursor-pointer hover:scale-150" : ""}`}
            style={{
              left: `calc(${note.position * 100}% - 6px)`,
            }}
            onClick={(e) => {
              if (recordingState === "complete") {
                e.stopPropagation()
                toggleNoteDirection(index)
              }
            }}
          />
        ))}

        {/* Center content */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            recordingState !== "idle" && "pointer-events-none",
          )}
          onClick={() => recordingState === "idle" && startRecording()}
        >
          {recordingState === "idle" && (
            <span className="text-muted-foreground">Click to begin recording</span>
          )}
          {recordingState === "countdown" && (
            <span className="animate-pulse text-4xl font-bold text-yellow-500">
              {countdownValue}
            </span>
          )}
          {recordingState === "recording" && originalClicks.length === 0 && (
            <span className="text-muted-foreground animate-pulse">Click here to mark strums!</span>
          )}
          {recordingState === "complete" && originalClicks.length === 0 && (
            <span className="text-muted-foreground">No clicks recorded. Try again!</span>
          )}
        </div>
      </div>

      {/* Click count */}
      {originalClicks.length > 0 && (
        <div className="text-muted-foreground text-center text-sm">
          {originalClicks.length} strum
          {originalClicks.length !== 1 ? "s" : ""} recorded
          {snappedClicks && ` (${snappedClicks.length} snapped)`}
        </div>
      )}

      {/* Snap to interval controls - only show when recording is complete and there are clicks */}
      {recordingState === "complete" && originalClicks.length > 0 && (
        <div className="bg-muted/30 rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span>Snap to Interval</span>
            {snappedClicks && (
              <button
                onClick={clearSnap}
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "4n", label: "1/4 beat" },
                { value: "8n", label: "1/8 beat" },
                { value: "16n", label: "1/16 beat" },
                { value: "32n", label: "1/32 beat" },
                { value: "64n", label: "1/64 beat" },
              ] as const
            ).map(({ value, label }) => (
              <Button
                key={value}
                variant={activeSnapInterval === value ? "default" : "outline"}
                size="sm"
                onClick={() => snapToInterval(value)}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {recordingState === "complete" && (
          <>
            {displayClicks.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => (isPreviewingPattern ? stopPreview() : startPreview(displayClicks))}
              >
                {isPreviewingPattern ? (
                  <SquareIcon className="h-4 w-4" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button onClick={startRecording} variant="outline">
              Re-record
            </Button>
            <div className="bg-border h-6 w-px" />
            <Button onClick={handleSavePattern} disabled={originalClicks.length === 0}>
              Save Pattern
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
