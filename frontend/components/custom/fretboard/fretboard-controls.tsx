import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react"
import { NUM_FRETS, NUM_STRINGS } from "./fretboard-canvas"
import { FretPositions } from "./fretboard-context"

interface FretControlsProps {
  fretPositions: FretPositions
  setFretPositions: React.Dispatch<React.SetStateAction<FretPositions>>
  strumNotes: (strum?: "up" | "down", positions?: FretPositions, time?: number) => void
  addChordToLine: () => void
}
export default function FretControls({
  fretPositions,
  setFretPositions,
  strumNotes,
  addChordToLine,
}: FretControlsProps) {
  const handleLower = () => {
    setFretPositions((prev) => {
      const newPositions = [...prev] as FretPositions
      for (let i = 0; i < NUM_STRINGS; i++) {
        if (newPositions[i] > 0) {
          newPositions[i] = newPositions[i] - 1
        }
      }
      return newPositions
    })
  }
  const handleHigher = () => {
    setFretPositions((prev) => {
      const newPositions = [...prev] as FretPositions
      for (let i = 0; i < NUM_STRINGS; i++) {
        if (newPositions[i] >= 0 && newPositions[i] < NUM_FRETS - 1) {
          newPositions[i] = newPositions[i] + 1
        }
      }
      return newPositions
    })
  }
  const handleReset = () => {
    setFretPositions([-1, -1, -1, -1, -1, -1] as FretPositions)
  }

  const handleAddToChordLine = () => {
    addChordToLine()
  }

  const isAllEmpty = fretPositions.every((fret) => fret === -1)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleLower}
        disabled={isAllEmpty || fretPositions.some((fret) => fret == 0)}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="outline"
        onClick={handleHigher}
        disabled={isAllEmpty || fretPositions.some((fret) => fret >= NUM_FRETS - 1)}
      >
        <ChevronRightIcon />
      </Button>
      <div className="bg-border h-6 w-px" />
      <Button variant="outline" onClick={handleReset} disabled={isAllEmpty}>
        <RefreshCwIcon />
      </Button>
      <div className="bg-border h-6 w-px" />
      <Button variant="outline" onClick={() => strumNotes("down")} disabled={isAllEmpty}>
        Strum down
      </Button>
      <Button variant="outline" onClick={() => strumNotes("up")} disabled={isAllEmpty}>
        Strum up
      </Button>
      <div className="bg-border h-6 w-px" />
      <Button variant="outline" onClick={handleAddToChordLine} disabled={isAllEmpty}>
        Add to Chord Line
      </Button>
    </div>
  )
}
