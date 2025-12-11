import { Button } from "@/components/ui/button"
import { PlayIcon, SquareIcon } from "lucide-react"
import { useState } from "react"
import { PreviewControls, StrumDirection, StrumNote } from "./strum-pattern-dialog"

type SnapInterval = "4n" | "8n" | "16n" | "32n" | "64n"

// Map intervals to number of slots per bar
const INTERVAL_SLOTS: Record<SnapInterval, number> = {
  "4n": 4,
  "8n": 8,
  "16n": 16,
  "32n": 32,
  "64n": 64,
}

interface ManualPatternCreatorProps {
  setStrumPattern: React.Dispatch<React.SetStateAction<StrumNote[]>>
  bpm: number
  barDurationMs: number
  manualClicks: StrumNote[]
  setManualClicks: React.Dispatch<React.SetStateAction<StrumNote[]>>
  previewControls: PreviewControls
}

export default function ManualPatternCreator({
  setStrumPattern,
  bpm,
  barDurationMs,
  manualClicks,
  setManualClicks,
  previewControls,
}: ManualPatternCreatorProps) {
  const { isPreviewingPattern, previewProgress, startPreview, stopPreview } = previewControls

  const [selectedInterval, setSelectedInterval] = useState<SnapInterval>("4n")

  const numSlots = INTERVAL_SLOTS[selectedInterval]

  // Get the note at a given slot position, if any
  const getNoteAtSlot = (slotIndex: number): StrumNote | undefined => {
    const position = slotIndex / numSlots
    return manualClicks.find((note) => Math.abs(note.position - position) < 0.0001)
  }

  // Handle clicking a slot: empty → down → up → empty
  const handleSlotClick = (slotIndex: number) => {
    const position = slotIndex / numSlots
    const existingNote = getNoteAtSlot(slotIndex)

    if (!existingNote) {
      // No note, add a downstrum
      setManualClicks((prev) =>
        [...prev, { position, direction: "down" as StrumDirection }].sort(
          (a, b) => a.position - b.position,
        ),
      )
    } else if (existingNote.direction === "down") {
      // Downstrum, change to upstrum
      setManualClicks((prev) =>
        prev.map((note) =>
          Math.abs(note.position - position) < 0.0001
            ? { ...note, direction: "up" as StrumDirection }
            : note,
        ),
      )
    } else {
      // Upstrum, remove the note
      setManualClicks((prev) => prev.filter((note) => Math.abs(note.position - position) >= 0.0001))
    }
  }

  const handleSavePattern = () => {
    stopPreview()
    setStrumPattern(manualClicks)
  }

  const handleClear = () => {
    stopPreview()
    setManualClicks([])
  }

  return (
    <div className="flex flex-col gap-4">
      {/* BPM display */}
      <div className="text-muted-foreground text-center text-sm">
        Manual pattern at {bpm} BPM (1 bar = {(barDurationMs / 1000).toFixed(1)}
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

      {/* Interval selection */}
      <div className="bg-muted/30 rounded-lg border p-3">
        <div className="mb-2 text-sm font-medium">Select Interval</div>
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
              variant={selectedInterval === value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedInterval(value)}
              className="text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Pattern grid */}
      <div
        className={`border-border bg-muted/50 relative h-32 overflow-hidden rounded-lg border-2 transition-all`}
      >
        {/* Progress bar during preview */}
        {isPreviewingPattern && (
          <div
            className="absolute top-0 left-0 z-0 h-full bg-green-500/20 transition-none"
            style={{ width: `${previewProgress * 100}%` }}
          />
        )}

        {/* Beat markers (quarters) */}
        <div className="pointer-events-none absolute top-0 right-0 left-0 flex h-full">
          {[0, 1, 2, 3].map((beat) => (
            <div
              key={beat}
              className="border-muted-foreground/30 flex-1 border-l border-dashed first:border-l-0"
            >
              <span className="text-muted-foreground/50 ml-1 text-xs">{beat + 1}</span>
            </div>
          ))}
        </div>

        {/* Clickable slots */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: numSlots }).map((_, slotIndex) => {
            const note = getNoteAtSlot(slotIndex)

            return (
              <button
                key={slotIndex}
                onClick={() => handleSlotClick(slotIndex)}
                className={`hover:bg-primary/10 flex h-full flex-1 cursor-pointer items-center justify-start transition-colors`}
              >
                {note && (
                  <div
                    className={`-ml-1.5 h-3 w-3 rounded-full border-2 shadow-md ${
                      note.direction === "down"
                        ? "border-blue-300 bg-blue-500"
                        : "border-orange-300 bg-orange-500"
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Click count */}
      {manualClicks.length > 0 && (
        <div className="text-muted-foreground text-center text-sm">
          {manualClicks.length} strum{manualClicks.length !== 1 ? "s" : ""} placed
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center gap-2">
        <Button onClick={handleClear} variant="outline" disabled={manualClicks.length === 0}>
          Clear
        </Button>
        {manualClicks.length > 0 && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => (isPreviewingPattern ? stopPreview() : startPreview(manualClicks))}
          >
            {isPreviewingPattern ? (
              <SquareIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button onClick={handleSavePattern} disabled={manualClicks.length === 0}>
          Save Pattern
        </Button>
      </div>
    </div>
  )
}
