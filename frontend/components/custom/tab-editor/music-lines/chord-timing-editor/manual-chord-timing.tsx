import { Button } from "@/components/ui/button"
import InputWithTicker from "@/components/ui/input-with-ticker"
import { cn } from "@/lib/utils"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Tone from "tone"
import { ChordStrum } from "../../context/tab-data-context"
import useTabContext from "../../tab-context-main"

// Sine tone frequencies for preview
const DOWN_STRUM_FREQ = 440 // A4
const UP_STRUM_FREQ = 523.25 // C5 (slightly higher)

type PreviewSource = "editor" | "saved" | null

export default function ManualChordTiming() {
  const { strumPattern, setStrumPattern, bpm } = useTabContext()

  // Local editing state - initialized from saved pattern
  const [localPattern, setLocalPattern] = useState<ChordStrum[]>(() => [...strumPattern])
  const [subdivisions, setSubdivisions] = useState(1)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Preview playback state
  const [previewPlaying, setPreviewPlaying] = useState<PreviewSource>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0) // 0-1 normalized position
  const synthRef = useRef<Tone.Synth | null>(null)
  const partRef = useRef<Tone.Part | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Sync local state when saved pattern changes externally
  useEffect(() => {
    setLocalPattern([...strumPattern])
  }, [strumPattern])

  // Check if local pattern differs from saved
  const hasUnsavedChanges = useMemo(() => {
    if (localPattern.length !== strumPattern.length) return true
    return localPattern.some(
      (strum, i) =>
        strum.position !== strumPattern[i]?.position ||
        strum.direction !== strumPattern[i]?.direction,
    )
  }, [localPattern, strumPattern])

  const handleSave = useCallback(() => {
    setStrumPattern([...localPattern])
  }, [localPattern, setStrumPattern])

  const handleCancel = useCallback(() => {
    setLocalPattern([...strumPattern])
  }, [strumPattern])

  const handleClear = useCallback(() => {
    setLocalPattern([])
  }, [])

  const positionsPerBar = 4 * (subdivisions + 1)

  const validPositions = useMemo(() => {
    const positions: number[] = []
    for (let i = 0; i < positionsPerBar; i++) {
      positions.push(i / positionsPerBar)
    }
    return positions
  }, [positionsPerBar])

  const snapToPosition = useCallback(
    (rawPosition: number): number => {
      const clamped = Math.max(0, Math.min(rawPosition, (positionsPerBar - 1) / positionsPerBar))

      const interval = 1 / positionsPerBar
      const snappedIndex = Math.round(clamped / interval)
      const maxIndex = positionsPerBar - 1
      return Math.min(snappedIndex, maxIndex) / positionsPerBar
    },
    [positionsPerBar],
  )

  const getPositionFromMouse = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return null

    const rect = gridRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const rawPosition = x / rect.width

    if (rawPosition < 0 || rawPosition >= 1) return null

    return rawPosition
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rawPosition = getPositionFromMouse(e)
      if (rawPosition === null) {
        setHoverPosition(null)
        return
      }
      setHoverPosition(snapToPosition(rawPosition))
    },
    [getPositionFromMouse, snapToPosition],
  )

  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rawPosition = getPositionFromMouse(e)
      if (rawPosition === null) return

      const snappedPosition = snapToPosition(rawPosition)

      const existingIndex = localPattern.findIndex((strum) => strum.position === snappedPosition)

      if (existingIndex !== -1) {
        setLocalPattern((prev) => prev.filter((strum) => strum.position !== snappedPosition))
      } else {
        const newStrum: ChordStrum = {
          position: snappedPosition,
          direction: "down",
          velocity: 1,
          mute: false,
        }
        setLocalPattern((prev) => [...prev, newStrum].sort((a, b) => a.position - b.position))
      }
    },
    [getPositionFromMouse, snapToPosition, localPattern],
  )

  const positionToBeat = (position: number) => {
    const beat = position * 4 + 1
    if (beat % 1 === 0) return null
    return beat.toFixed(2)
  }

  const hoverHasStrum = useMemo(() => {
    if (hoverPosition === null) return false
    const tolerance = 0.001
    return localPattern.some((strum) => Math.abs(strum.position - hoverPosition) < tolerance)
  }, [hoverPosition, localPattern])

  // Start playhead animation
  const startPlayheadAnimation = useCallback(() => {
    const barDurationSeconds = (4 / bpm) * 60

    const animate = () => {
      const transportSeconds = Tone.getTransport().seconds
      const positionInBar = (transportSeconds % barDurationSeconds) / barDurationSeconds
      setPlayheadPosition(positionInBar)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [bpm])

  // Stop playhead animation
  const stopPlayheadAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setPlayheadPosition(0)
  }, [])

  // Stop preview and clean up resources
  const stopPreview = useCallback(() => {
    stopPlayheadAnimation()
    if (partRef.current) {
      partRef.current.stop()
      partRef.current.dispose()
      partRef.current = null
    }
    if (synthRef.current) {
      synthRef.current.dispose()
      synthRef.current = null
    }
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
    setPreviewPlaying(null)
  }, [stopPlayheadAnimation])

  // Start preview playback for a given pattern
  const startPreview = useCallback(
    async (source: PreviewSource, pattern: ChordStrum[]) => {
      if (pattern.length === 0) return

      // Stop any existing preview first
      stopPreview()

      await Tone.start()

      // Set BPM to match the actual player
      Tone.getTransport().bpm.value = bpm

      // Create synth for sine tones
      const synth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.01,
          decay: 0.1,
          sustain: 0.1,
          release: 0.2,
        },
      }).toDestination()
      synthRef.current = synth

      // Calculate bar duration in seconds (4 beats per bar in 4/4 time)
      // This matches exactly how tab-player-context.tsx calculates timing
      const barDurationSeconds = (4 / bpm) * 60

      // Build events from the pattern
      type PartEvent = { time: number; direction: "up" | "down" }
      const events: PartEvent[] = pattern.map((strum) => ({
        time: strum.position * barDurationSeconds,
        direction: strum.direction,
      }))

      // Create the Part with seconds-based timing (same as tab-player-context.tsx)
      const part = new Tone.Part<PartEvent>((time, event) => {
        const freq = event.direction === "down" ? DOWN_STRUM_FREQ : UP_STRUM_FREQ
        synth.triggerAttackRelease(freq, "16n", time)
      }, events)

      part.loop = true
      part.loopStart = 0
      part.loopEnd = barDurationSeconds

      partRef.current = part

      // Reset and start (same pattern as tab-player-context.tsx)
      Tone.getTransport().position = 0
      part.start(0)
      Tone.getTransport().start()

      startPlayheadAnimation()
      setPreviewPlaying(source)
    },
    [bpm, stopPreview, startPlayheadAnimation],
  )

  // Toggle preview for editor pattern
  const toggleEditorPreview = useCallback(() => {
    if (previewPlaying === "editor") {
      stopPreview()
    } else {
      startPreview("editor", localPattern)
    }
  }, [previewPlaying, stopPreview, startPreview, localPattern])

  // Toggle preview for saved pattern
  const toggleSavedPreview = useCallback(() => {
    if (previewPlaying === "saved") {
      stopPreview()
    } else {
      startPreview("saved", strumPattern)
    }
  }, [previewPlaying, stopPreview, startPreview, strumPattern])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (partRef.current) {
        partRef.current.dispose()
      }
      if (synthRef.current) {
        synthRef.current.dispose()
      }
      Tone.getTransport().stop()
      Tone.getTransport().cancel()
    }
  }, [])

  // Stop preview if BPM changes while playing
  useEffect(() => {
    if (previewPlaying) {
      // Restart preview with new BPM
      const currentSource = previewPlaying
      const pattern = currentSource === "editor" ? localPattern : strumPattern
      startPreview(currentSource, pattern)
    }
  }, [bpm]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-2">
      <p>Manual timing</p>

      <div className="rounded-lg border p-2">
        Subdivisions per beat:
        <div className="w-16">
          <InputWithTicker
            value={subdivisions}
            onValueChange={(value) => setSubdivisions(value)}
            step={1}
            min={0}
            max={11}
          />
        </div>
      </div>

      {/* Main bar grid ui */}
      <div className="h-24 border-y">
        <div className="flex h-full pl-2">
          {/* Previous bar indicator (beat 4 of previous bar) */}
          <div className="relative w-px">
            <div className="h-full w-0 border-r border-dashed" />
            <span className="text-muted-foreground/50 absolute -bottom-5 -left-0.75 text-sm leading-4">
              4
            </span>
          </div>

          {/* Interactive grid area */}
          <div
            ref={gridRef}
            className="relative mx-6 h-full grow cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            {/* Beat markers */}
            {[0, 1, 2, 3].map((beat) => {
              const position = beat / 4
              return (
                <div
                  key={beat}
                  className="absolute top-0 h-full w-px"
                  style={{ left: `${position * 100}%` }}
                >
                  <div className="bg-border h-full w-px" />
                  <span className="text-muted-foreground absolute -bottom-5 -left-0.75 text-sm leading-4">
                    {beat + 1}
                  </span>
                </div>
              )
            })}

            {/* Subdivision markers */}
            {validPositions.map((position) => {
              // Skip main beat positions
              if (position % 0.25 === 0) return null
              return (
                <div
                  key={position}
                  className="absolute top-1/4 h-1/2 w-px"
                  style={{ left: `${position * 100}%` }}
                >
                  <div className="bg-border/40 h-full w-px" />
                </div>
              )
            })}

            {/* Existing strums (local editing state) */}
            {localPattern.map((strum, index) => (
              <div
                key={index}
                className="absolute top-0 h-full"
                style={{ left: `${strum.position * 100}%`, transform: "translateX(-50%)" }}
              >
                <div
                  className={cn(
                    "h-full w-1 rounded-full",
                    strum.direction === "down" ? "bg-primary" : "bg-primary/70",
                  )}
                />
                {/* Direction indicator */}
                <div className="text-primary absolute -top-5 left-1/2 -translate-x-1/2 text-xs">
                  {strum.direction === "down" ? "↓" : "↑"}
                </div>
              </div>
            ))}

            {/* Hover indicator */}
            {hoverPosition !== null && (
              <div
                className="pointer-events-none absolute top-0 flex h-full flex-col items-center"
                style={{ left: `${hoverPosition * 100}%`, transform: "translateX(-50%)" }}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    hoverHasStrum ? "bg-destructive w-1" : "bg-primary w-0.5",
                  )}
                />
                {(() => {
                  const beat = positionToBeat(hoverPosition)
                  if (!beat) return null
                  return (
                    <div className="text-muted-foreground/50 absolute -bottom-4.5 text-xs leading-3">
                      {beat}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Playhead indicator for editor preview */}
            {previewPlaying === "editor" && (
              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-green-500"
                style={{ left: `${playheadPosition * 100}%`, transform: "translateX(-50%)" }}
              />
            )}
          </div>

          <div className="relative flex w-px flex-col items-center pr-4">
            <div className="h-full w-0 border-r border-dashed" />
            <span className="text-muted-foreground/50 absolute -bottom-5 text-sm leading-4">1</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={!hasUnsavedChanges}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClear}
          disabled={localPattern.length === 0}
        >
          Clear
        </Button>
        <Button
          size="sm"
          variant={previewPlaying === "editor" ? "destructive" : "secondary"}
          onClick={toggleEditorPreview}
          disabled={localPattern.length === 0}
        >
          {previewPlaying === "editor" ? "Stop" : "Preview"}
        </Button>
      </div>

      {/* Saved pattern preview */}
      {strumPattern.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">Saved pattern:</p>
            <Button
              size="sm"
              variant={previewPlaying === "saved" ? "destructive" : "outline"}
              onClick={toggleSavedPreview}
              className="h-6 px-2 text-xs"
            >
              {previewPlaying === "saved" ? "Stop" : "Preview"}
            </Button>
          </div>
          <div className="bg-muted/30 relative h-8 rounded border">
            {/* Beat markers for preview */}
            {[0, 1, 2, 3].map((beat) => (
              <div
                key={beat}
                className="bg-border/50 absolute top-0 h-full w-px"
                style={{ left: `${(beat / 4) * 100}%` }}
              />
            ))}
            {/* Saved strums */}
            {strumPattern.map((strum, index) => (
              <div
                key={index}
                className="absolute top-0 h-full"
                style={{ left: `${strum.position * 100}%`, transform: "translateX(-50%)" }}
              >
                <div
                  className={cn(
                    "h-full w-1 rounded-full",
                    strum.direction === "down" ? "bg-primary/60" : "bg-primary/40",
                  )}
                />
              </div>
            ))}
            {/* Playhead indicator for saved preview */}
            {previewPlaying === "saved" && (
              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-green-500"
                style={{ left: `${playheadPosition * 100}%`, transform: "translateX(-50%)" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
