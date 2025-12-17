import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import InputWithTicker from "@/components/ui/input-with-ticker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ArrowDownIcon, ArrowUpIcon, PlayIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Tone from "tone"
import { ChordStrum } from "../../context/tab-data-context"
import useTabContext from "../../tab-context-main"

const DOWN_STRUM_FREQ = 440 // A4
const UP_STRUM_FREQ = 523.25 // C5 (slightly higher)

type PreviewSource = "editor" | "saved" | null

// Quantization utility functions
function getQuantizeGrid(subdivisions: number): number[] {
  const positionsPerBar = 4 * (subdivisions + 1)
  const positions: number[] = []
  for (let i = 0; i < positionsPerBar; i++) {
    positions.push(i / positionsPerBar)
  }
  return positions
}

function getNearestQuantizePositions(
  position: number,
  subdivisions: number,
): { lower: number; upper: number; nearest: number } {
  const grid = getQuantizeGrid(subdivisions)
  let lower = 0
  let upper = grid[grid.length - 1]

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] <= position) lower = grid[i]
    if (grid[i] >= position) {
      upper = grid[i]
      break
    }
  }

  const nearest = position - lower <= upper - position ? lower : upper
  return { lower, upper, nearest }
}

function getQuantizedPosition(position: number, subdivisions: number, percent: number): number {
  const { nearest } = getNearestQuantizePositions(position, subdivisions)
  const distance = nearest - position
  return position + distance * (percent / 100)
}

function isAlignedToGrid(position: number, subdivisions: number, tolerance = 0.001): boolean {
  const grid = getQuantizeGrid(subdivisions)
  return grid.some((gridPos) => Math.abs(gridPos - position) < tolerance)
}

export default function ManualChordTiming() {
  const { strumPattern, setStrumPattern, bpm } = useTabContext()

  const [localPattern, setLocalPattern] = useState<ChordStrum[]>(() => [...strumPattern])
  const [subdivisions, setSubdivisions] = useState(1)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [localBpm, setLocalBpm] = useState(bpm)
  const [placementMode, setPlacementMode] = useState<"snap" | "free">("free")
  const gridRef = useRef<HTMLDivElement>(null)

  const [previewPlaying, setPreviewPlaying] = useState<PreviewSource>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const synthRef = useRef<Tone.Synth | null>(null)
  const partRef = useRef<Tone.Part | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Quantization state for all strums
  const [globalQuantizeOpen, setGlobalQuantizeOpen] = useState(false)
  const [globalQuantizePercent, setGlobalQuantizePercent] = useState(50)

  // Quantization state for single strum (track by position)
  const [singleQuantizePosition, setSingleQuantizePosition] = useState<number | null>(null)
  const [singleQuantizePercent, setSingleQuantizePercent] = useState(50)

  useEffect(() => {
    setLocalPattern([...strumPattern])
  }, [strumPattern])

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
      const elements = document.elementsFromPoint(e.clientX, e.clientY)
      if (elements.some((element) => element.classList.contains("data-is-strum"))) {
        setHoverPosition(null)
        return
      }
      const position = placementMode === "free" ? rawPosition : snapToPosition(rawPosition)
      setHoverPosition(position)
    },
    [getPositionFromMouse, snapToPosition, placementMode],
  )

  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (hoverPosition === null) return
      const rawPosition = getPositionFromMouse(e)
      if (rawPosition === null) return

      const targetPosition = placementMode === "free" ? rawPosition : snapToPosition(rawPosition)

      const tolerance = placementMode === "free" ? 0.0075 : 0.001
      const existingIndex = localPattern.findIndex(
        (strum) => Math.abs(strum.position - targetPosition) < tolerance,
      )

      if (existingIndex !== -1) {
        setLocalPattern((prev) =>
          prev.filter((strum) => Math.abs(strum.position - targetPosition) >= tolerance),
        )
      } else {
        const newStrum: ChordStrum = {
          position: targetPosition,
          direction: "down",
          velocity: 1,
          mute: false,
        }
        setLocalPattern((prev) => [...prev, newStrum].sort((a, b) => a.position - b.position))
      }
    },
    [getPositionFromMouse, snapToPosition, localPattern, hoverPosition, placementMode],
  )

  const positionToBeat = (position: number) => {
    const beat = position * 4 + 1
    if (beat % 1 === 0) return null
    return beat.toFixed(placementMode === "free" ? 3 : 2)
  }

  const hoverHasStrum = useMemo(() => {
    if (hoverPosition === null) return false
    const tolerance = placementMode === "free" ? 0.0075 : 0.001
    return localPattern.some((strum) => Math.abs(strum.position - hoverPosition) < tolerance)
  }, [hoverPosition, localPattern, placementMode])

  // Check if all strums are aligned to the current global quantize grid
  const allStrumsAligned = useMemo(() => {
    if (localPattern.length === 0) return true
    return localPattern.every((strum) => isAlignedToGrid(strum.position, subdivisions))
  }, [localPattern, subdivisions])

  // Get the quantize grid for global quantization
  const globalQuantizeGrid = useMemo(() => {
    return getQuantizeGrid(subdivisions)
  }, [subdivisions])

  // Get preview positions for all strums when global quantize is open
  const globalQuantizePreviews = useMemo(() => {
    if (!globalQuantizeOpen) return []
    return localPattern
      .filter((strum) => !isAlignedToGrid(strum.position, subdivisions))
      .map((strum) => ({
        original: strum.position,
        preview: getQuantizedPosition(strum.position, subdivisions, globalQuantizePercent),
      }))
  }, [globalQuantizeOpen, localPattern, subdivisions, globalQuantizePercent])

  // Get single strum quantize info
  const singleQuantizeInfo = useMemo(() => {
    if (singleQuantizePosition === null) return null
    const { lower, upper } = getNearestQuantizePositions(singleQuantizePosition, subdivisions)
    const preview = getQuantizedPosition(
      singleQuantizePosition,
      subdivisions,
      singleQuantizePercent,
    )
    const isAligned = isAlignedToGrid(singleQuantizePosition, subdivisions)
    return { lower, upper, preview, isAligned }
  }, [singleQuantizePosition, subdivisions, singleQuantizePercent])

  // Apply global quantization
  const applyGlobalQuantize = useCallback(() => {
    setLocalPattern((prev) =>
      prev.map((strum) => ({
        ...strum,
        position: getQuantizedPosition(strum.position, subdivisions, globalQuantizePercent),
      })),
    )
    setGlobalQuantizeOpen(false)
  }, [subdivisions, globalQuantizePercent])

  // Apply single strum quantization
  const applySingleQuantize = useCallback(() => {
    if (singleQuantizePosition === null) return
    setLocalPattern((prev) =>
      prev.map((strum) =>
        strum.position === singleQuantizePosition
          ? {
              ...strum,
              position: getQuantizedPosition(strum.position, subdivisions, singleQuantizePercent),
            }
          : strum,
      ),
    )
    setSingleQuantizePosition(null)
  }, [singleQuantizePosition, subdivisions, singleQuantizePercent])

  const startPlayheadAnimation = useCallback(() => {
    const barDurationSeconds = (4 / localBpm) * 60

    const animate = () => {
      const transportSeconds = Tone.getTransport().seconds
      const positionInBar = (transportSeconds % barDurationSeconds) / barDurationSeconds
      setPlayheadPosition(positionInBar)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [localBpm])

  const stopPlayheadAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setPlayheadPosition(0)
  }, [])

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

  const startPreview = useCallback(
    async (source: PreviewSource, pattern: ChordStrum[]) => {
      if (pattern.length === 0) return

      stopPreview()

      await Tone.start()

      Tone.getTransport().bpm.value = localBpm

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

      const barDurationSeconds = (4 / localBpm) * 60

      type PartEvent = { time: number; direction: "up" | "down" }
      const events: PartEvent[] = pattern.map((strum) => ({
        time: strum.position * barDurationSeconds,
        direction: strum.direction,
      }))

      const part = new Tone.Part<PartEvent>((time, event) => {
        const freq = event.direction === "down" ? DOWN_STRUM_FREQ : UP_STRUM_FREQ
        synth.triggerAttackRelease(freq, "16n", time)
      }, events)

      part.loop = true
      part.loopStart = 0
      part.loopEnd = barDurationSeconds

      partRef.current = part

      Tone.getTransport().position = 0
      part.start(0)
      Tone.getTransport().start()

      startPlayheadAnimation()
      setPreviewPlaying(source)
    },
    [localBpm, stopPreview, startPlayheadAnimation],
  )

  const toggleEditorPreview = useCallback(() => {
    if (previewPlaying === "editor") {
      stopPreview()
    } else {
      startPreview("editor", localPattern)
    }
  }, [previewPlaying, stopPreview, startPreview, localPattern])

  const toggleSavedPreview = useCallback(() => {
    if (previewPlaying === "saved") {
      stopPreview()
    } else {
      startPreview("saved", strumPattern)
    }
  }, [previewPlaying, stopPreview, startPreview, strumPattern])

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

  useEffect(() => {
    if (previewPlaying) {
      const currentSource = previewPlaying
      const pattern = currentSource === "editor" ? localPattern : strumPattern
      startPreview(currentSource, pattern)
    }
  }, [localBpm]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-stretch gap-2">
        <div className="flex grow items-center gap-4 rounded-md border p-2">
          <div>
            Placement mode:
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={placementMode === "snap" ? "default" : "outline"}
                onClick={() => setPlacementMode("snap")}
              >
                Snap
              </Button>
              <Button
                size="sm"
                variant={placementMode === "free" ? "default" : "outline"}
                onClick={() => setPlacementMode("free")}
              >
                Free
              </Button>
            </div>
          </div>

          <div>
            BPM:
            <div className="w-16">
              <InputWithTicker
                value={localBpm}
                onValueChange={(value) => setLocalBpm(value)}
                step={5}
                min={30}
                max={240}
              />
            </div>
          </div>
          <div>
            Subdivisions:
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
          <div>
            <Popover open={globalQuantizeOpen} onOpenChange={setGlobalQuantizeOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={localPattern.length === 0 || allStrumsAligned}
                >
                  Quantize
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" className="flex flex-col gap-2">
                <div>
                  Percent:
                  <div className="w-16">
                    <InputWithTicker
                      value={globalQuantizePercent}
                      onValueChange={(value) => setGlobalQuantizePercent(value)}
                      step={5}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={applyGlobalQuantize}>
                    Apply
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setGlobalQuantizeOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-md border p-2">
          <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={!hasUnsavedChanges}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={handleClear}
              disabled={localPattern.length === 0}
            >
              <Trash2Icon />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={toggleEditorPreview}
              disabled={localPattern.length === 0}
            >
              {previewPlaying === "editor" ? <SquareIcon /> : <PlayIcon />}
            </Button>
          </div>
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
            className="relative ml-4 h-full grow cursor-crosshair"
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
              <HoverCard
                key={`strum-${index}`}
                openDelay={75}
                closeDelay={0}
                onOpenChange={(open) => {
                  if (!open) {
                    setSingleQuantizePosition(null)
                  }
                }}
              >
                <HoverCardTrigger asChild>
                  <div
                    style={{ left: `${strum.position * 100}%`, transform: "translateX(-50%)" }}
                    className="data-is-strum absolute top-0 h-full cursor-pointer hover:px-2"
                  >
                    <div className="relative h-full w-1">
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
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  sideOffset={0}
                  className="data-is-strum flex items-center gap-2 p-1"
                >
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setLocalPattern((prev) =>
                        prev.filter((existingStrum) => existingStrum.position !== strum.position),
                      )
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      setLocalPattern((prev) =>
                        prev.map((existingStrum) =>
                          existingStrum.position === strum.position
                            ? {
                                ...existingStrum,
                                direction: existingStrum.direction === "down" ? "up" : "down",
                              }
                            : existingStrum,
                        ),
                      )
                    }}
                  >
                    {strum.direction === "up" ? <ArrowUpIcon /> : <ArrowDownIcon />}
                  </Button>
                  <Popover
                    open={singleQuantizePosition === strum.position}
                    onOpenChange={(open) => {
                      if (open) {
                        setSingleQuantizePosition(strum.position)
                        setSingleQuantizePercent(100)
                      } else {
                        setSingleQuantizePosition(null)
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isAlignedToGrid(strum.position, subdivisions)}
                      >
                        Quantize
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" className="data-is-strum flex flex-col gap-2">
                      <div>
                        Percent:
                        <div className="w-16">
                          <InputWithTicker
                            value={singleQuantizePercent}
                            onValueChange={(value) => setSingleQuantizePercent(value)}
                            step={5}
                            min={0}
                            max={100}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={applySingleQuantize}>
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSingleQuantizePosition(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </HoverCardContent>
              </HoverCard>
            ))}

            {/* Global quantize grid lines (shown when global quantize popover is open) */}
            {globalQuantizeOpen &&
              globalQuantizeGrid.map((position) => (
                <div
                  key={`global-grid-${position}`}
                  className="pointer-events-none absolute top-0 h-full w-px bg-yellow-500/40"
                  style={{ left: `${position * 100}%`, transform: "translateX(-50%)" }}
                />
              ))}

            {/* Global quantize preview positions (where strums will move to) */}
            {globalQuantizeOpen &&
              globalQuantizePreviews.map(({ original, preview }) => (
                <div
                  key={`global-preview-${original}`}
                  className="pointer-events-none absolute top-0 h-full"
                  style={{ left: `${preview * 100}%`, transform: "translateX(-50%)" }}
                >
                  <div className="h-full w-1 rounded-full bg-yellow-500/70" />
                </div>
              ))}

            {/* Single strum quantize: two nearest grid lines */}
            {singleQuantizeInfo && singleQuantizePosition !== null && (
              <>
                <div
                  className="pointer-events-none absolute top-0 h-full w-px bg-yellow-500/40"
                  style={{
                    left: `${singleQuantizeInfo.lower * 100}%`,
                    transform: "translateX(-50%)",
                  }}
                />
                <div
                  className="pointer-events-none absolute top-0 h-full w-px bg-yellow-500/40"
                  style={{
                    left: `${singleQuantizeInfo.upper * 100}%`,
                    transform: "translateX(-50%)",
                  }}
                />
                {/* Preview position for single strum */}
                {!singleQuantizeInfo.isAligned && (
                  <div
                    className="pointer-events-none absolute top-0 h-full"
                    style={{
                      left: `${singleQuantizeInfo.preview * 100}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="h-full w-1 rounded-full bg-yellow-500/70" />
                  </div>
                )}
              </>
            )}

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

          <div className="relative flex w-px flex-col items-center pr-2">
            <div className="h-full w-0 border-r border-dashed" />
            <span className="text-muted-foreground/50 absolute -bottom-5 text-sm leading-4">1</span>
          </div>
        </div>
      </div>

      {/* Saved pattern preview */}
      {strumPattern.length > 0 && (
        <div className="flex flex-col gap-2 pr-2 pl-6">
          <div className="flex items-center gap-2">
            <p className="font-medium">Saved pattern:</p>
            <Button
              size="iconXs"
              variant={previewPlaying === "saved" ? "destructive" : "outline"}
              onClick={toggleSavedPreview}
              className="h-6 px-2 text-xs"
            >
              {previewPlaying === "saved" ? <SquareIcon /> : <PlayIcon />}
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
