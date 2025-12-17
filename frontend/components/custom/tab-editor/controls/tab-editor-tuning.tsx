"use client"

import InputWithTicker from "@/components/ui/input-with-ticker"
import { Separator } from "@/components/ui/separator"
import { STANDARD_TUNING_NOTES } from "@/lib/constants"
import { applyTuningToNoteCharacter } from "@/lib/midi-utils"
import { arraysEqual } from "@/lib/utils"
import { Tuning } from "../context/tab-tuning-context"

interface TabEditorTuningProps {
  tuning: Tuning
  setTuning: React.Dispatch<React.SetStateAction<Tuning>>
}
export default function TabEditorTuning({ tuning, setTuning }: TabEditorTuningProps) {
  const tunedNotes = STANDARD_TUNING_NOTES.map((note, index) =>
    applyTuningToNoteCharacter(note, tuning[index]),
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        {tuning.toReversed().map((note, index) => (
          <div key={`tuning-${index}`} className="flex flex-col items-center">
            <InputWithTicker
              value={note}
              step={0.5}
              min={-3}
              max={3}
              onValueChange={(value) =>
                setTuning((prev) => {
                  const newTuning = [...prev] as Tuning
                  newTuning[5 - index] = value
                  return newTuning
                })
              }
            />
            <span className="text-muted-foreground text-sm">{tunedNotes[5 - index]}</span>
          </div>
        ))}
      </div>
      <Separator />
      <h3 className="-my-2 text-lg font-medium">Presets</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          data-selected={arraysEqual(tuning, [-1, 0, 0, 0, 0, 0])}
          onClick={() => setTuning([-1, 0, 0, 0, 0, 0])}
          className="hover:bg-accent data-[selected=true]:bg-accent flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors duration-100"
        >
          <span className="font-medium">Standard</span>
          <span className="text-muted-foreground bg-accent rounded-md border px-2 py-1 text-sm">
            E A D G B E
          </span>
        </button>
        <button
          data-selected={arraysEqual(tuning, [-1, 0, 0, 0, 0, 0])}
          onClick={() => setTuning([-1, 0, 0, 0, 0, 0])}
          className="hover:bg-accent data-[selected=true]:bg-accent flex cursor-pointer items-center justify-between rounded-md border p-2 transition-colors duration-100"
        >
          <span className="font-medium">Drop D</span>
          <span className="text-muted-foreground bg-accent rounded-md border px-2 py-1 text-sm">
            D A D G B E
          </span>
        </button>
      </div>
    </div>
  )
}
